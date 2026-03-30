import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import type { AgentToolContext } from "@/lib/agent/types";

vi.mock("@/lib/agent/subagents/analytics-subagent", () => ({
  runAnalyticsSubAgent: vi.fn()
}));
vi.mock("@/lib/agent/subagents/calendar-email-subagent", () => ({
  runCalendarEmailSubAgent: vi.fn()
}));
vi.mock("@/lib/agent/subagents/presentation-subagent", () => ({
  runPresentationSubAgent: vi.fn(),
  runPresentationFromRowsSubAgent: vi.fn()
}));
vi.mock("@/lib/agent/subagents/weekly-report-subagent", () => ({
  runWeeklyReportSubAgent: vi.fn()
}));
vi.mock("@/lib/agent/subagents/web-search-subagent", () => ({
  runWebSearchSubAgent: vi.fn()
}));
vi.mock("@/lib/agent/subagents/market-listings-chat-subagent", () => ({
  runMarketListingsChatSubAgent: vi.fn()
}));
vi.mock("@/lib/agent/subagents/scheduled-task-proposal-subagent", () => ({
  runScheduledTaskProposalSubAgent: vi.fn()
}));
vi.mock("@/lib/agent/subagents/casual-chat-subagent", () => ({
  runCasualChatSubAgent: vi.fn()
}));

import { runAgentOrchestrator } from "@/lib/agent/orchestrator/agent-orchestrator";
import { runAnalyticsSubAgent } from "@/lib/agent/subagents/analytics-subagent";
import { runMarketListingsChatSubAgent } from "@/lib/agent/subagents/market-listings-chat-subagent";
import { runPresentationFromRowsSubAgent } from "@/lib/agent/subagents/presentation-subagent";

describe("runAgentOrchestrator pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runMarketListingsChatSubAgent).mockResolvedValue({
      answer_text: "Nalezeny nove nabidky.",
      confidence: 0.9,
      sources: ["https://example/listing"],
      generated_artifacts: [],
      next_actions: [],
      dataPanel: {
        kind: "market_listings",
        title: "Nové nabídky (1)",
        listings: [
          {
            external_id: "x1",
            title: "Byt 2+kk",
            location: "Praha",
            source: "sreality",
            url: "https://example/listing"
          }
        ]
      }
    });
    vi.mocked(runPresentationFromRowsSubAgent).mockResolvedValue({
      publicUrl: "https://example/deck.pptx",
      pdfPublicUrl: "https://example/deck.pdf",
      totalSlidesLabel: 4,
      includeOpeningTitleSlide: true
    });
    vi.mocked(runAnalyticsSubAgent).mockResolvedValue({
      answer_text: "Analytika hotova.",
      confidence: 0.9,
      sources: ["vw_clients"],
      generated_artifacts: [],
      next_actions: [],
      dataPanel: {
        kind: "clients_filtered",
        source: "vw_clients",
        title: "Klienti",
        rows: [{ month: "2026-03", value: 10 }]
      }
    });
  });

  it("composes market_listings + presentation pipeline from one request", async () => {
    const ctx: AgentToolContext = { runId: "r1", userId: "u1" };
    const toolRunner = { run: vi.fn() } as unknown as ToolRunner;

    const out = await runAgentOrchestrator({
      intent: "market_listings",
      ctx,
      question: "Najdi nove nabidky v Praze a udelej prezentaci o 3 slidech",
      contextText: "",
      trace: undefined,
      traceDispatchId: null,
      toolRunner
    });

    expect(runMarketListingsChatSubAgent).toHaveBeenCalledOnce();
    expect(runPresentationFromRowsSubAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        slideCount: 3,
        rows: [expect.objectContaining({ title: "Byt 2+kk" })]
      })
    );
    expect(out.generated_artifacts).toEqual([
      expect.objectContaining({ type: "presentation", url: "https://example/deck.pptx" }),
      expect.objectContaining({ type: "presentation", url: "https://example/deck.pdf" })
    ]);
    expect(out.answer_text).toContain("Nalezeny nove nabidky.");
    expect(out.answer_text).toContain("Vytvořil jsem prezentaci");
  });

  it("composes analytics + presentation pipeline from one request", async () => {
    const ctx: AgentToolContext = { runId: "r2", userId: "u1" };
    const toolRunner = { run: vi.fn() } as unknown as ToolRunner;

    const out = await runAgentOrchestrator({
      intent: "analytics",
      ctx,
      question: "Zpracuj analytiku klientu a priprav prezentaci o 3 slidech",
      contextText: "",
      trace: undefined,
      traceDispatchId: null,
      toolRunner
    });

    expect(runAnalyticsSubAgent).toHaveBeenCalledOnce();
    expect(runPresentationFromRowsSubAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        slideCount: 3,
        rows: [{ month: "2026-03", value: 10 }]
      })
    );
    expect(out.generated_artifacts).toEqual([
      expect.objectContaining({ type: "presentation", url: "https://example/deck.pptx" }),
      expect.objectContaining({ type: "presentation", url: "https://example/deck.pdf" })
    ]);
    expect(out.answer_text).toContain("Analytika hotova.");
    expect(out.answer_text).toContain("Na základě analytických dat");
  });

  it("replans and skips presentation step when no rows are available", async () => {
    vi.mocked(runAnalyticsSubAgent).mockResolvedValueOnce({
      answer_text: "Analytika hotova bez tabulky.",
      confidence: 0.8,
      sources: ["vw_clients"],
      generated_artifacts: [],
      next_actions: []
    });

    const ctx: AgentToolContext = { runId: "r3", userId: "u1" };
    const toolRunner = { run: vi.fn() } as unknown as ToolRunner;
    const out = await runAgentOrchestrator({
      intent: "analytics",
      ctx,
      question: "Udelej analytiku a prezentaci o 3 slidech",
      contextText: "",
      trace: undefined,
      traceDispatchId: null,
      toolRunner
    });

    expect(runPresentationFromRowsSubAgent).not.toHaveBeenCalled();
    expect(out.answer_text).toContain("Analytika hotova bez tabulky.");
    expect(out.answer_text).toContain("Plán upraven podle kontextu");
  });
});
