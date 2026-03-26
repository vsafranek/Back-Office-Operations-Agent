import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";

export async function runWeeklyReportSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  slideCount: number;
  question: string;
}): Promise<AgentAnswer> {
  const data = await params.toolRunner.run<{ rows: Record<string, unknown>[]; source: string }>("runSqlPreset", params.ctx, {
    question: "lead prodane 6 mesic",
    runId: params.ctx.runId
  });

  const report = await params.toolRunner.run<{ csvPublic: string; mdPublic: string }>("generateReportArtifacts", params.ctx, {
    runId: params.ctx.runId,
    title: "Tydenni executive report",
    rows: data.rows
  });

  const presentation = await params.toolRunner.run<{ publicUrl: string; pdfPublicUrl: string }>(
    "generatePresentationArtifact",
    params.ctx,
    {
      runId: params.ctx.runId,
      title: "Tydenni executive report",
      rows: data.rows,
      context: params.question,
      slideCount: params.slideCount
    }
  );

  return {
    answer_text: `Tydenni report byl vygenerovan vcetne podkladovych dat a prezentace (${params.slideCount} slidu) v cestine.`,
    confidence: 0.8,
    sources: [data.source],
    generated_artifacts: [
      { type: "report", label: "CSV dataset", url: report.csvPublic },
      { type: "report", label: "Markdown summary", url: report.mdPublic },
      { type: "presentation", label: `Prezentace (${params.slideCount} slidu) PPTX`, url: presentation.publicUrl },
      { type: "presentation", label: `Prezentace (${params.slideCount} slidu) PDF`, url: presentation.pdfPublicUrl }
    ],
    next_actions: ["Zkontroluj navrzeny obsah slidu a uprav finalni verzi pro vedeni."]
  };
}

