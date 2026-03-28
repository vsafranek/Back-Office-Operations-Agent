import { persistQ1SourceChannelChartPng } from "@/lib/agent/analytics/chart-png";
import { buildLeadsVsSalesChart } from "@/lib/agent/analytics/leads-vs-sales-chart";
import { buildSourceChannelChart } from "@/lib/agent/analytics/source-channel-chart";
import { logger } from "@/lib/observability/logger";
import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";
import { shouldSuppressChartInPanel } from "@/lib/agent/question-panel-hints";
import { fetchCrmSheetsForReport, shouldAttachCrmPortfolioSheets } from "@/lib/agent/tools/crm-excel-sheets";

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

  let extraSheets: Awaited<ReturnType<typeof fetchCrmSheetsForReport>> | undefined;
  if (shouldAttachCrmPortfolioSheets(params.question)) {
    try {
      extraSheets = await fetchCrmSheetsForReport();
    } catch (e) {
      logger.warn("crm_excel_sheets_failed", {
        runId: params.ctx.runId,
        message: e instanceof Error ? e.message : String(e)
      });
    }
  }

  const report = await params.toolRunner.run<{ csvPublic: string; mdPublic: string; xlsxPublic: string }>(
    "generateReportArtifacts",
    params.ctx,
    {
      runId: params.ctx.runId,
      title: "Ad-hoc analyticky vystup",
      rows: data.rows,
      ...(extraSheets?.length ? { extraSheets } : {})
    }
  );

  const showChannelChart =
    data.suggestSourceChannelChart && data.preset === "new_clients_q1" && !data.rowTextNarrowing;

  const showLeadsSalesChart =
    data.preset === "leads_vs_sales_6m" && !data.rowTextNarrowing;
  const leadsSalesChart = showLeadsSalesChart ? buildLeadsVsSalesChart(data.rows) : null;

  let chart: ReturnType<typeof buildSourceChannelChart> | null = null;
  let chartSummary: string;
  let chartPngPublicUrl: string | null = null;
  if (showChannelChart) {
    const q1Chart = buildSourceChannelChart(data.rows);
    chart = q1Chart;
    chartSummary =
      q1Chart.labels.length === 0
        ? "Podle zdroje: žádní klienti v datasetu."
        : `Podle zdroje (kanál): ${q1Chart.labels.map((l, i) => `${l}: ${q1Chart.values[i]}`).join(", ")}`;

    if (q1Chart.labels.length > 0) {
      try {
        chartPngPublicUrl = await persistQ1SourceChannelChartPng({
          runId: params.ctx.runId,
          chart: q1Chart
        });
      } catch (err) {
        logger.warn("chart_png_persist_failed", {
          runId: params.ctx.runId,
          message: err instanceof Error ? err.message : String(err)
        });
      }
    }
  } else if (showLeadsSalesChart && leadsSalesChart && leadsSalesChart.labels.length > 0) {
    const parts = leadsSalesChart.labels.map(
      (lab, i) => `${lab}: ${leadsSalesChart.leads[i] ?? 0} leadů / ${leadsSalesChart.sold[i] ?? 0} prodaných`
    );
    chartSummary =
      `V pravém panelu UI je sloupcový graf vývoje (modře leady, zeleně prodané) po měsících. ` +
      `Souhrn měsíců: ${parts.join("; ")}. ` +
      `Uživatel často explicitně žádá graf — v answer_text popiš trend z čísel a kladně zmíni, že graf vidí v panelu vedle odpovědi. ` +
      `NIKDY nepiš, že graf „nelze“ nebo „nevynucuješ“, nebo že by byl k dispozici jen tabulka bez grafu.`;
  } else if (data.rowTextNarrowing) {
    chartSummary = `Textové zúžení: „${data.rowTextNarrowing}“. Graf podle kanálu negeneruj, pokud k tomu uživatel výslovně nepobízí a data jsou už vyfiltrované.`;
  } else {
    chartSummary =
      "Graf podle zdroje (kanál) použij jen u přehledu nových klientů Q1 bez textového filtru; u leadů vs prodeje za 6 měsíců je graf v UI, pokud je preset leads_vs_sales_6m.";
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
      `Artefakty: CSV ${report.csvPublic}, prehled MD ${report.mdPublic}, Excel ${report.xlsxPublic}${
        extraSheets?.length
          ? " (workbook ma listy Data + Properties + Leads + Deals z interni DB)."
          : ""
      }${chartPngPublicUrl ? `, graf PNG ${chartPngPublicUrl}` : ""}`,
      "Shrnut vysledky pro uzivatele (cisla musi sedet s daty vyse) a navrhni dalsi kroky."
    ].join("\n\n")
  });

  const tableTitle = data.filterLabel?.trim() || `Data: ${data.source}`;

  const hideChartUi = shouldSuppressChartInPanel(params.question);

  const dataPanel =
    showChannelChart && chart != null
      ? {
          kind: "clients_q1" as const,
          source: data.source,
          rows: data.rows,
          chart,
          ...(hideChartUi ? { hideChart: true as const } : {})
        }
      : showLeadsSalesChart && leadsSalesChart && leadsSalesChart.labels.length > 0
        ? {
            kind: "leads_sales_6m" as const,
            source: data.source,
            rows: data.rows,
            chart: leadsSalesChart,
            ...(hideChartUi ? { hideChart: true as const } : {})
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
      { type: "report", label: "Souhrn (Markdown)", url: report.mdPublic },
      { type: "table", label: "Dataset (Excel)", url: report.xlsxPublic },
      ...(chartPngPublicUrl
        ? ([
            { type: "chart" as const, label: "Graf zdroje kanálu (PNG)", url: chartPngPublicUrl }
          ] as const)
        : [])
    ],
    next_actions: reply.next_actions,
    dataPanel,
    dataPanelDownloads: {
      excel: report.xlsxPublic,
      csv: report.csvPublic
    }
  };
}
