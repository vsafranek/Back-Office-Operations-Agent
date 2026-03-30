import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";

vi.mock("@/lib/agent/subagents/report-data-subagent", () => ({
  runReportDataSubAgent: vi.fn()
}));

vi.mock("@/lib/agent/subagents/presentation-subagent", () => ({
  runPresentationFromRowsSubAgent: vi.fn()
}));

vi.mock("@/lib/agent/llm/user-facing-reply", () => ({
  generateUserFacingReply: vi.fn().mockResolvedValue({
    answer_text: "Hotovo.",
    confidence: 0.93,
    next_actions: ["Zkontroluj vystupy."]
  })
}));

import { runReportDataSubAgent } from "@/lib/agent/subagents/report-data-subagent";
import { runPresentationFromRowsSubAgent } from "@/lib/agent/subagents/presentation-subagent";
import { runWeeklyReportSubAgent } from "@/lib/agent/subagents/weekly-report-subagent";

describe("runWeeklyReportSubAgent two-step flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runReportDataSubAgent).mockResolvedValue({
      rows: [{ month: "2026-03", leads: 10 }],
      source: "vw_weekly_metrics",
      report: {
        csvPublic: "https://example/csv",
        mdPublic: "https://example/md",
        xlsxPublic: "https://example/xlsx"
      }
    });
    vi.mocked(runPresentationFromRowsSubAgent).mockResolvedValue({
      publicUrl: "https://example/pptx",
      pdfPublicUrl: "https://example/pdf",
      totalSlidesLabel: 4,
      includeOpeningTitleSlide: true
    });
  });

  it("runs data/report task first and passes its rows into presentation task", async () => {
    const toolRunner = { run: vi.fn() } as unknown as ToolRunner;
    const ctx: AgentToolContext = { runId: "r1", userId: "u1" };

    const answer = await runWeeklyReportSubAgent({
      toolRunner,
      ctx,
      slideCount: 3,
      question: "Shrn vysledky minuleho tydne a priprav prezentaci",
      title: "Tydenni report"
    });

    expect(runReportDataSubAgent).toHaveBeenCalledOnce();
    expect(runPresentationFromRowsSubAgent).toHaveBeenCalledOnce();
    expect(runPresentationFromRowsSubAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [{ month: "2026-03", leads: 10 }],
        sourceLabel: "vw_weekly_metrics",
        slideCount: 3
      })
    );
    expect(answer.generated_artifacts.map((a) => a.url)).toEqual([
      "https://example/csv",
      "https://example/md",
      "https://example/xlsx",
      "https://example/pptx",
      "https://example/pdf"
    ]);
  });
});
