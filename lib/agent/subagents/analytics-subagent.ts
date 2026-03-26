import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";

export async function runAnalyticsSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  question: string;
}): Promise<AgentAnswer> {
  const data = await params.toolRunner.run<{ rows: Record<string, unknown>[]; source: string }>("runSqlPreset", params.ctx, {
    question: params.question,
    runId: params.ctx.runId
  });

  const report = await params.toolRunner.run<{ csvPublic: string; mdPublic: string }>("generateReportArtifacts", params.ctx, {
    runId: params.ctx.runId,
    title: "Ad-hoc analyticky vystup",
    rows: data.rows
  });

  const sampleRows = data.rows.slice(0, 50);
  const reply = await generateUserFacingReply({
    runId: params.ctx.runId,
    maxTokens: 1000,
    userContent: [
      `Puvodni dotaz uzivatele: ${params.question}`,
      `SQL zdroj / preset: ${data.source}`,
      `Pocet radek: ${data.rows.length}`,
      "Ukazka radku (JSON):",
      JSON.stringify(sampleRows, null, 2),
      `Artefakty: CSV ${report.csvPublic}, prehled MD ${report.mdPublic}`,
      "Shrnut vysledky pro uzivatele a navrhni dalsi kroky."
    ].join("\n\n")
  });

  return {
    answer_text: reply.answer_text,
    confidence: reply.confidence,
    sources: [data.source],
    generated_artifacts: [
      { type: "table", label: "Dataset CSV", url: report.csvPublic },
      { type: "chart", label: "Summary markdown", url: report.mdPublic }
    ],
    next_actions: reply.next_actions
  };
}
