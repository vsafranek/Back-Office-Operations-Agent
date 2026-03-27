import { buildSourceChannelChart } from "@/lib/agent/analytics/source-channel-chart";
import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";

export async function runAnalyticsSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  question: string;
}): Promise<AgentAnswer> {
  const data = await params.toolRunner.run<{
    rows: Record<string, unknown>[];
    source: string;
    preset: string;
  }>("runSqlPreset", params.ctx, {
    question: params.question,
    runId: params.ctx.runId
  });

  const report = await params.toolRunner.run<{ csvPublic: string; mdPublic: string }>("generateReportArtifacts", params.ctx, {
    runId: params.ctx.runId,
    title: "Ad-hoc analyticky vystup",
    rows: data.rows
  });

  const chart = buildSourceChannelChart(data.rows);
  const chartSummary =
    chart.labels.length === 0
      ? "Podle zdroje: žádní klienti v datasetu."
      : `Podle zdroje (kanál): ${chart.labels.map((l, i) => `${l}: ${chart.values[i]}`).join(", ")}`;

  const sampleRows = data.rows.slice(0, 50);
  const reply = await generateUserFacingReply({
    runId: params.ctx.runId,
    maxTokens: 1000,
    trace: params.ctx.trace
      ? {
          recorder: params.ctx.trace,
          parentId: params.ctx.traceParentId ?? null,
          name: "llm.subagent.analytics.reply"
        }
      : undefined,
    userContent: [
      `Puvodni dotaz uzivatele: ${params.question}`,
      `SQL zdroj / preset: ${data.source} (${data.preset})`,
      `Pocet radek: ${data.rows.length}`,
      chartSummary,
      "Ukazka radku (JSON):",
      JSON.stringify(sampleRows, null, 2),
      `Artefakty: CSV ${report.csvPublic}, prehled MD ${report.mdPublic}`,
      "Shrnut vysledky pro uzivatele (cisla musi sedet s agregaci vyse) a navrhni dalsi kroky."
    ].join("\n\n")
  });

  const dataPanel =
    data.preset === "new_clients_q1"
      ? {
          kind: "clients_q1" as const,
          source: data.source,
          rows: data.rows,
          chart
        }
      : undefined;

  return {
    answer_text: reply.answer_text,
    confidence: reply.confidence,
    sources: [data.source],
    generated_artifacts: [
      { type: "table", label: "Dataset (CSV)", url: report.csvPublic },
      { type: "report", label: "Souhrn (Markdown)", url: report.mdPublic }
    ],
    next_actions: reply.next_actions,
    dataPanel
  };
}
