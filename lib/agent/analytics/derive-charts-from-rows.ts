import { logger } from "@/lib/observability/logger";
import { axisLabelYForCount, columnLabelCs, valueUnitForColumn } from "@/lib/agent/analytics/chart-labels-cs";
import { buildLeadsVsSalesChart } from "@/lib/agent/analytics/leads-vs-sales-chart";
import { buildSourceChannelChart } from "@/lib/agent/analytics/source-channel-chart";
import type { ChartKind, DerivedChartModel } from "@/lib/agent/types";

export type DeriveChartsParams = {
  rows: Record<string, unknown>[];
  preset: string;
  suggestSourceChannelChart: boolean;
  suggestDerivedCharts: boolean;
  rowTextNarrowing?: string;
  /** Nápověda z plánu (LLM) — upřednostní typ, pokud je s daty slučitelný. */
  derivedChartKindHint?: ChartKind | null;
};

const MAX_CHARTS = 3;
const MAX_BAR_CATEGORIES = 16;
const MAX_PIE_SEGMENTS = 10;
const CLIENT_AGG_COLUMNS = [
  "source_channel",
  "preferred_city",
  "preferred_district",
  "property_type_interest"
] as const;

function isBlank(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

function categoryKey(raw: unknown): string {
  if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return "(neuvedeno)";
}

function aggregateCountsByColumn(
  rows: Record<string, unknown>[],
  column: string
): { labels: string[]; values: number[] } {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = categoryKey(row[column]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const head = entries.slice(0, MAX_BAR_CATEGORIES);
  const tail = entries.slice(MAX_BAR_CATEGORIES);
  const otherSum = tail.reduce((s, [, n]) => s + n, 0);
  const capped = otherSum > 0 ? [...head, ["Ostatní" as string, otherSum] as [string, number]] : head;
  return {
    labels: capped.map(([l]) => l),
    values: capped.map(([, v]) => v)
  };
}

function parseRowMonth(row: Record<string, unknown>): number | null {
  const v = row.created_at;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

function aggregateCreatedAtByMonth(rows: Record<string, unknown>[]): {
  labels: string[];
  values: number[];
} | null {
  const buckets = new Map<string, { t: number; n: number }>();
  let noDate = 0;
  for (const row of rows) {
    const t = parseRowMonth(row);
    if (t == null) {
      noDate += 1;
      continue;
    }
    const d = new Date(t);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const prev = buckets.get(key);
    if (prev) prev.n += 1;
    else buckets.set(key, { t: d.getTime(), n: 1 });
  }
  if (buckets.size === 0) return null;
  if (buckets.size === 1 && noDate === 0) return null;
  const sorted = [...buckets.entries()].sort((a, b) => a[1].t - b[1].t);
  const labels: string[] = sorted.map(([k]) => {
    const [y, m] = k.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("cs-CZ", { month: "short", year: "numeric" });
  });
  const values: number[] = sorted.map(([, { n }]) => n);
  if (noDate > 0) {
    labels.push("(bez data)");
    values.push(noDate);
  }
  return { labels, values };
}

function pickKindForSingleSeries(params: {
  columnKey: string;
  labels: string[];
  hint?: ChartKind | null;
  timeLike: boolean;
}): ChartKind {
  const { columnKey, labels, hint, timeLike } = params;
  if (hint === "line") return "line";
  if (hint === "bar") return "bar";
  if (hint === "pie" && labels.length <= MAX_PIE_SEGMENTS) return "pie";
  if (timeLike || columnKey === "created_at") return "line";
  if (labels.length <= MAX_PIE_SEGMENTS && labels.length >= 2) return "pie";
  return "bar";
}

function assertCountSumMatchesRows(
  chartId: string,
  values: number[],
  rowCount: number,
  preset: string
): void {
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum !== rowCount) {
    logger.warn("derived_chart_invariant_mismatch", {
      chartId,
      preset,
      sum,
      rowCount
    });
  }
}

function sourceChannelDerivedChart(rows: Record<string, unknown>[]): DerivedChartModel {
  const built = buildSourceChannelChart(rows);
  const colLabel = columnLabelCs("source_channel");
  const rowCount = rows.length;
  assertCountSumMatchesRows("q1_source_channel", built.values, rowCount, "new_clients_q1");
  return {
    kind: "bar",
    title: "Noví klienti v Q1 — počet podle zdroje",
    subtitle: `Graf z týchž ${rowCount} řádků jako v tabulce.`,
    axisLabelX: colLabel,
    axisLabelY: axisLabelYForCount(colLabel),
    valueUnit: valueUnitForColumn("source_channel", "count"),
    labels: built.labels,
    values: built.values,
    legend: [{ label: "Počet klientů" }],
    rowCountInTable: rowCount
  };
}

function leadsSalesDerivedChart(rows: Record<string, unknown>[]): DerivedChartModel {
  const built = buildLeadsVsSalesChart(rows);
  const n = built.labels.length;
  const leadSum = built.leads.reduce((a, b) => a + b, 0);
  const soldSum = built.sold.reduce((a, b) => a + b, 0);
  if (leadSum + soldSum > 0 && n > 0) {
    logger.info("derived_chart_leads_6m", { months: n, leadSum, soldSum });
  }
  return {
    kind: "line",
    title: built.title,
    subtitle: `Graf z týchž ${rows.length} řádků jako v tabulce.`,
    axisLabelX: "Měsíc",
    axisLabelY: "Počet",
    valueUnit: "záznamů",
    labels: built.labels,
    values: built.leads,
    series2Values: built.sold,
    series2Label: "Prodané",
    legend: [{ label: "Leady" }, { label: "Prodané" }],
    rowCountInTable: rows.length
  };
}

function singleSeriesChart(
  rows: Record<string, unknown>[],
  columnKey: string,
  hint: ChartKind | null | undefined
): DerivedChartModel | null {
  const { labels, values } = aggregateCountsByColumn(rows, columnKey);
  if (labels.length === 0 || values.every((v) => v === 0)) return null;

  const colLabel = columnLabelCs(columnKey);
  const rowCount = rows.length;
  assertCountSumMatchesRows(`clients_${columnKey}`, values, rowCount, "clients");

  const timeLike = false;
  const resolvedKind = pickKindForSingleSeries({ columnKey, labels, hint, timeLike });

  const base = {
    title: `Rozklad podle: ${colLabel}`,
    subtitle: `Graf z týchž ${rowCount} řádků jako v tabulce.`,
    axisLabelX: colLabel,
    axisLabelY: axisLabelYForCount(colLabel),
    valueUnit: valueUnitForColumn(columnKey, "count"),
    labels,
    values,
    legend: [{ label: "Počet záznamů" }],
    rowCountInTable: rowCount
  };

  if (resolvedKind === "pie") {
    const total = values.reduce((a, b) => a + b, 0);
    if (total !== rowCount) {
      logger.warn("pie_partial_categories", { columnKey, total, rowCount });
    }
    return { kind: "pie", ...base };
  }
  if (resolvedKind === "line") {
    const pairs = labels.map((l, i) => ({ l, v: values[i] ?? 0 }));
    pairs.sort((a, b) => a.l.localeCompare(b.l, "cs"));
    return {
      kind: "line",
      ...base,
      labels: pairs.map((p) => p.l),
      values: pairs.map((p) => p.v)
    };
  }
  return { kind: "bar", ...base };
}

/**
 * Deterministické grafy výhradně z agregace předaných řádků (stejná instance jako tabulka).
 */
export function deriveChartsFromRows(params: DeriveChartsParams): DerivedChartModel[] {
  const {
    rows,
    preset,
    suggestSourceChannelChart,
    suggestDerivedCharts,
    rowTextNarrowing,
    derivedChartKindHint
  } = params;
  const narrowing = Boolean(rowTextNarrowing?.trim());

  if (rows.length === 0) return [];

  const out: DerivedChartModel[] = [];

  if (preset === "leads_vs_sales_6m" && !narrowing) {
    const c = leadsSalesDerivedChart(rows);
    if (c.labels.length > 0) out.push(c);
    return out;
  }

  if (preset === "new_clients_q1" && suggestSourceChannelChart && !narrowing) {
    const c = sourceChannelDerivedChart(rows);
    if (c.labels.length > 0) out.push(c);
    return out;
  }

  if (preset === "clients" && suggestDerivedCharts && !narrowing) {
    const monthAgg = aggregateCreatedAtByMonth(rows);
    if (monthAgg && out.length < MAX_CHARTS) {
      const colLabel = columnLabelCs("created_at");
      const kind: ChartKind =
        derivedChartKindHint === "pie"
          ? "bar"
          : pickKindForSingleSeries({
              columnKey: "created_at",
              labels: monthAgg.labels,
              hint: derivedChartKindHint,
              timeLike: true
            });
      const base = {
        title: "Noví / registrovaní klienti podle měsíce",
        subtitle: `Graf z týchž ${rows.length} řádků jako v tabulce.`,
        axisLabelX: "Měsíc",
        axisLabelY: axisLabelYForCount(colLabel),
        valueUnit: valueUnitForColumn("created_at", "count"),
        labels: monthAgg.labels,
        values: monthAgg.values,
        legend: [{ label: "Počet záznamů" }],
        rowCountInTable: rows.length
      };
      assertCountSumMatchesRows("clients_created_month", monthAgg.values, rows.length, "clients");
      out.push(
        kind === "line"
          ? { kind: "line", ...base }
          : kind === "pie"
            ? { kind: "pie", ...base }
            : { kind: "bar", ...base }
      );
    }

    for (const col of CLIENT_AGG_COLUMNS) {
      if (out.length >= MAX_CHARTS) break;
      if (!rows.some((r) => !isBlank(r[col]))) continue;
      const chart = singleSeriesChart(rows, col, derivedChartKindHint);
      if (chart) out.push(chart);
    }
  }

  return out.slice(0, MAX_CHARTS);
}
