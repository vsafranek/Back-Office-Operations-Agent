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
});
