import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
const insertMock = vi.fn();
const updateEqMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();

vi.mock("@/lib/supabase/server-client", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: fromMock
  }))
}));

vi.mock("@/lib/agent/index", () => ({
  runBackOfficeAgent: vi.fn()
}));

vi.mock("@/lib/scheduled-tasks/cron-helpers", () => ({
  shouldRunScheduledTaskNow: vi.fn(() => true)
}));

vi.mock("@/lib/agent/tools/market-listings-tool", () => ({
  fetchMarketListings: vi.fn(async () => []),
  mergeStoredMarketListingsParams: vi.fn((stored: unknown) => (stored ? { location: "Praha", sources: ["sreality"] } : null))
}));

vi.mock("@/lib/market-listings/record-user-market-listing-finds", () => ({
  recordUserMarketListingFinds: vi.fn(async () => {})
}));

vi.mock("@/lib/agent/conversation/agent-panel-persist", () => ({
  buildAgentPanelPersistPayload: vi.fn(() => null)
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() }
}));

import { runBackOfficeAgent } from "@/lib/agent/index";
import { runScheduledAgentTasksCycle } from "@/lib/scheduled-tasks/run-scheduled-agent-tasks";

describe("runScheduledAgentTasksCycle execution intent enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    eqMock.mockImplementation(() => ({ data: [], error: null }));
    selectMock.mockImplementation(() => ({ eq: eqMock }));
    updateEqMock.mockImplementation(() => ({ error: null }));
    updateMock.mockImplementation(() => ({ eq: updateEqMock }));
    insertMock.mockImplementation(async () => ({ error: null }));

    fromMock.mockImplementation((table: string) => {
      if (table === "user_scheduled_agent_tasks") {
        return { select: selectMock, update: updateMock };
      }
      if (table === "scheduled_task_run_notifications") {
        return { insert: insertMock };
      }
      throw new Error(`unexpected table ${table}`);
    });

    vi.mocked(runBackOfficeAgent).mockResolvedValue({
      runId: "run-1",
      answer_text: "Hotovo.",
      confidence: 0.9,
      sources: [],
      generated_artifacts: [],
      next_actions: []
    });
  });

  it("uses explicit scheduled execution intent marker from system prompt", async () => {
    eqMock.mockImplementationOnce(() => ({
      data: [
        {
          id: "t1",
          user_id: "u1",
          title: "Task",
          cron_expression: "0 8 * * *",
          timezone: "Europe/Prague",
          system_prompt: "[[SCHEDULED_EXECUTION_INTENT:market_listings]]\nPouzij pouze inzeraty z portalu.",
          user_question: "Najdi nove byty",
          agent_id: "basic",
          enabled: true,
          last_run_at: null,
          market_listings_params: null
        }
      ],
      error: null
    }));

    await runScheduledAgentTasksCycle({ respectTimeWindow: false });

    expect(runBackOfficeAgent).toHaveBeenCalledOnce();
    const args = vi.mocked(runBackOfficeAgent).mock.calls[0]?.[0];
    expect(args?.orchestratorQuestionPrefix).toContain('POVINNE pouzij intent "market_listings"');
    expect(args?.orchestratorQuestionPrefix).toContain("Pouzij pouze inzeraty z portalu.");
    expect(args?.orchestratorQuestionPrefix).not.toContain("SCHEDULED_EXECUTION_INTENT");
  });

  it("falls back to market_listings intent when marker is missing but listing params exist", async () => {
    eqMock.mockImplementationOnce(() => ({
      data: [
        {
          id: "t2",
          user_id: "u1",
          title: "Task fallback",
          cron_expression: "0 8 * * *",
          timezone: "Europe/Prague",
          system_prompt: "Monitoruj nove byty v lokalite.",
          user_question: "Najdi nove byty",
          agent_id: "basic",
          enabled: true,
          last_run_at: null,
          market_listings_params: { location: "Praha" }
        }
      ],
      error: null
    }));

    await runScheduledAgentTasksCycle({ respectTimeWindow: false });

    const args = vi.mocked(runBackOfficeAgent).mock.calls[0]?.[0];
    expect(args?.orchestratorQuestionPrefix).toContain('POVINNE pouzij intent "market_listings"');
  });
});
