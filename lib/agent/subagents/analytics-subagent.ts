import { deriveChartsFromRows } from "@/lib/agent/analytics/derive-charts-from-rows";
import { persistDerivedChartPng } from "@/lib/agent/analytics/chart-png";
import { logger } from "@/lib/observability/logger";
import {
  type AgentAnswer,
  type AgentDataPanelChartPng,
  type AgentToolContext,
  agentArtifactStoragePathKey
} from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";
import { shouldSuppressChartInPanel } from "@/lib/agent/question-panel-hints";
import { fetchCrmSheetsForReport, shouldAttachCrmPortfolioSheets } from "@/lib/agent/tools/crm-excel-sheets";

export async function runAnalyticsSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  question: string;
  onAnswerDelta?: (chunk: string) => void | Promise<void>;
}): Promise<AgentAnswer> {
  const storageKey = agentArtifactStoragePathKey(params.ctx);
  const data = await params.toolRunner.run<{
    rows: Record<string, unknown>[];
    source: string;
    preset: string;
    rowTextNarrowing?: string;
    filterLabel?: string;
    suggestSourceChannelChart: boolean;
    suggestDerivedCharts: boolean;
    derivedChartKindHint?: "bar" | "line" | "pie" | null;
  }>("runSqlPreset", params.ctx, {
    question: params.question,
    runId: storageKey
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
      runId: storageKey,
      title: "Ad-hoc analyticky vystup",
      rows: data.rows,
      ...(extraSheets?.length ? { extraSheets } : {})
    }
  );

  const derivedCharts = deriveChartsFromRows({
    rows: data.rows,
    preset: data.preset,
    suggestSourceChannelChart: data.suggestSourceChannelChart,
    suggestDerivedCharts: data.suggestDerivedCharts,
    rowTextNarrowing: data.rowTextNarrowing,
    derivedChartKindHint: data.derivedChartKindHint ?? null
  });

  const chartPngs: AgentDataPanelChartPng[] = [];
  const chartArtifacts: { type: "chart"; label: string; url: string }[] = [];

  for (let i = 0; i < derivedCharts.length; i++) {
    const ch = derivedCharts[i]!;
    try {
      const url = await persistDerivedChartPng({
        runId: storageKey,
        chart: ch,
        fileSuffix: `${i}-${ch.kind}`
      });
      if (url) {
        chartPngs.push({
          label: `Graf (PNG) — ${ch.title.slice(0, 48)}${ch.title.length > 48 ? "…" : ""}`,
          url,
          kind: ch.kind
        });
        chartArtifacts.push({
          type: "chart",
          label: chartPngs[chartPngs.length - 1]!.label,
          url
        });
      }
    } catch (err) {
      logger.warn("chart_png_persist_failed", {
        runId: params.ctx.runId,
        chartIndex: i,
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }

  const showChannelChart =
    data.suggestSourceChannelChart && data.preset === "new_clients_q1" && !data.rowTextNarrowing;
  const showLeadsSalesChart =
    data.preset === "leads_vs_sales_6m" && !data.rowTextNarrowing && derivedCharts.length > 0;

  let chartSummary: string;
  if (derivedCharts.length > 0) {
    const parts = derivedCharts.map((c) => {
      if (c.kind === "line" && c.series2Values && c.series2Values.length === c.labels.length) {
        const head = c.labels
          .map((lab, i) => `${lab}: ${c.values[i] ?? 0}/${c.series2Values![i] ?? 0}`)
          .slice(0, 4)
          .join("; ");
        return `${c.title} (${head}${c.labels.length > 4 ? "…" : ""})`;
      }
      const head = c.labels.map((lab, i) => `${lab}: ${c.values[i] ?? 0}`).slice(0, 5).join(", ");
      return `${c.title}: ${head}${c.labels.length > 5 ? "…" : ""}`;
    });
    chartSummary =
      `V panelu Nástroje jsou k dispozici grafy (${derivedCharts.length}) z týchž řádků jako tabulka — záložky Tabulka / Grafy. ` +
      `Souhrn: ${parts.join(" | ")}. ` +
      `Popis trendu nebo rozkladu v answer_text musi sedet s temito cisly.`;
  } else if (data.preset === "new_clients_q1" && data.rowTextNarrowing) {
    chartSummary = `Textové zúžení: „${data.rowTextNarrowing}“. Graf podle kanálu v tomto běhu negenerujeme (agregace Q1 je po zúžení vypnutá).`;
  } else if (data.preset === "new_clients_q1" && !showChannelChart && !data.rowTextNarrowing) {
    chartSummary =
      "Plán dat: bez grafu podle kanálu v UI — odpovídej z tabulky a čísel. Nezmiňuj graf v pravém panelu ani odkazy na sloupcový přehled podle zdroje, protože ten v tomto běhu není.";
  } else if (data.rowTextNarrowing) {
    chartSummary = `Textové zúžení: „${data.rowTextNarrowing}“. Odvozené grafy nad tabulkou jen pokud jsou v datech k dispozici (agregace stejných řádků).`;
  } else {
    chartSummary =
      "Grafy se zobrazí jen pokud plán dat povolí agregaci (Q1 kanál, leady 6 měsíců, nebo clients + rozklad).";
  }

  if (showLeadsSalesChart) {
    chartSummary +=
      " U leadů vs prodané byty za 6 měsíců je v grafu dvojserie (leady / prodané byty) — v answer_text popiš trend z čísel a kladně zmíni graf v panelu.";
  }

  const dataScopeNote =
    data.preset === "new_clients_q1"
      ? [
          "Časové okno dat: view vw_new_clients_q1 odpovídá pouze 1. čtvrtletí běžného roku (časová zóna Europe/Prague).",
          "Pokud uživatel mínil jiný kalendářní rok nebo širší období, upřímně uveď, že aktuální výpis to neobsahuje, a navrhni upřesnění dotazu."
        ].join(" ")
      : data.preset === "leads_vs_sales_6m"
        ? "Časové okno: view posledních ~6 měsíců — leady (všechny) vs. prodané byty (obchody bez cancelled, nemovitost typu byt nebo bez vazby na nemovitost); není libovolné období od–do zadané uživatelem."
        : data.preset === "deal_sales_detail"
          ? "Dataset: jednotlivé uzavřené obchody (kdo koupil, jaká nemovitost, datum, cena) z interního pohledu vw_deal_sales_detail."
          : "";

  const sampleRows = data.rows.slice(0, 50);
  const pngList =
    chartArtifacts.length > 0
      ? chartArtifacts.map((a) => `${a.label}: ${a.url}`).join(", ")
      : "";
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
    onAnswerDelta: params.onAnswerDelta,
    userContent: [
      `Puvodni dotaz uzivatele: ${params.question}`,
      `Datovy zdroj: ${data.source} (dataset: ${data.preset})`,
      dataScopeNote,
      `Pocet radek: ${data.rows.length}`,
      chartSummary,
      "Ukazka radku (JSON):",
      JSON.stringify(sampleRows, null, 2),
      `Artefakty: CSV ${report.csvPublic}, prehled MD ${report.mdPublic}, Excel ${report.xlsxPublic}${
        extraSheets?.length
          ? " (workbook ma listy Data + Properties + Leads + Deals z interni DB)."
          : ""
      }${pngList ? `, ${pngList}` : ""}`,
      "Shrnut vysledky pro uzivatele (cisla musi sedet s daty vyse) a navrhni dalsi kroky."
    ].join("\n\n")
  });

  const tableTitle = data.filterLabel?.trim() || `Data: ${data.source}`;

  const hideChartUi = shouldSuppressChartInPanel(params.question);

  const dataPanel =
    data.preset === "new_clients_q1"
      ? {
          kind: "clients_q1" as const,
          source: data.source,
          rows: data.rows,
          charts: derivedCharts,
          ...(hideChartUi ? { hideChart: true as const } : {})
        }
      : data.preset === "leads_vs_sales_6m"
        ? {
            kind: "leads_sales_6m" as const,
            source: data.source,
            rows: data.rows,
            charts: derivedCharts,
            ...(hideChartUi ? { hideChart: true as const } : {})
          }
        : data.preset === "deal_sales_detail"
          ? {
              kind: "deal_sales_detail" as const,
              source: data.source,
              title: tableTitle,
              rows: data.rows,
              ...(derivedCharts.length > 0 ? { charts: derivedCharts } : {}),
              ...(hideChartUi ? { hideChart: true as const } : {})
            }
          : {
              kind: "clients_filtered" as const,
              source: data.source,
              title: tableTitle,
              rows: data.rows,
              ...(derivedCharts.length > 0 ? { charts: derivedCharts } : {}),
              ...(hideChartUi ? { hideChart: true as const } : {})
            };

  return {
    answer_text: reply.answer_text,
    confidence: reply.confidence,
    sources: [data.source],
    generated_artifacts: [
      { type: "table", label: "Dataset (CSV)", url: report.csvPublic },
      { type: "report", label: "Souhrn (Markdown)", url: report.mdPublic },
      { type: "table", label: "Dataset (Excel)", url: report.xlsxPublic },
      ...chartArtifacts
    ],
    next_actions: reply.next_actions,
    dataPanel,
    dataPanelDownloads: {
      excel: report.xlsxPublic,
      csv: report.csvPublic,
      ...(chartPngs.length > 0 ? { chartPngs } : {})
    }
  };
}
