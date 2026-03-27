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
    rowTextNarrowing?: string;
    filterLabel?: string;
    suggestSourceChannelChart: boolean;
  }>("runSqlPreset", params.ctx, {
    question: params.question,
    runId: params.ctx.runId
  });

  const report = await params.toolRunner.run<{ csvPublic: string; mdPublic: string }>("generateReportArtifacts", params.ctx, {
    runId: params.ctx.runId,
    title: "Ad-hoc analyticky vystup",
    rows: data.rows
  });

  const showChannelChart =
    data.suggestSourceChannelChart && data.preset === "new_clients_q1" && !data.rowTextNarrowing;

  let chart: ReturnType<typeof buildSourceChannelChart> | null = null;
  let chartSummary: string;
  if (showChannelChart) {
    const q1Chart = buildSourceChannelChart(data.rows);
    chart = q1Chart;
    chartSummary =
      q1Chart.labels.length === 0
        ? "Podle zdroje: žádní klienti v datasetu."
        : `Podle zdroje (kanál): ${q1Chart.labels.map((l, i) => `${l}: ${q1Chart.values[i]}`).join(", ")}`;
  } else if (data.rowTextNarrowing) {
    chartSummary = `Textové zúžení: „${data.rowTextNarrowing}“. Graf podle kanálu negeneruj, pokud k tomu uživatel výslovně nepobízí a data jsou už vyfiltrované.`;
  } else {
    chartSummary =
      "Graf podle zdroje (kanál) použij jen u přehledu nových klientů Q1 bez textového filtru; jinak tabulka nebo souhrn bez vynuceného grafu.";
  }

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
      `Datovy zdroj: ${data.source} (dataset: ${data.preset})`,
      `Pocet radek: ${data.rows.length}`,
      chartSummary,
      "Ukazka radku (JSON):",
      JSON.stringify(sampleRows, null, 2),
      `Artefakty: CSV ${report.csvPublic}, prehled MD ${report.mdPublic}`,
      "Shrnut vysledky pro uzivatele (cisla musi sedet s daty vyse) a navrhni dalsi kroky."
    ].join("\n\n")
  });

  const tableTitle = data.filterLabel?.trim() || `Data: ${data.source}`;

  const dataPanel =
    showChannelChart && chart != null
      ? {
          kind: "clients_q1" as const,
          source: data.source,
          rows: data.rows,
          chart
        }
      : {
          kind: "clients_filtered" as const,
          source: data.source,
          title: tableTitle,
          rows: data.rows
        };

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
