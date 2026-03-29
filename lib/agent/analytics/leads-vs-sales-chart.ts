/**
 * Řádky z view `vw_leads_vs_sales_6m`: měsíc + leads_count + sold_count.
 */
export type LeadsVsSalesChartModel = {
  title: string;
  labels: string[];
  leads: number[];
  sold: number[];
};

function parseMonthValue(row: Record<string, unknown>): Date | null {
  const m = row.month;
  if (m instanceof Date) return m;
  if (typeof m === "string") {
    const d = new Date(m);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  return 0;
}

export function buildLeadsVsSalesChart(rows: Record<string, unknown>[]): LeadsVsSalesChartModel {
  const parsed = rows
    .map((row) => {
      const dt = parseMonthValue(row);
      if (!dt) return null;
      return {
        t: dt.getTime(),
        label: dt.toLocaleDateString("cs-CZ", { month: "short", year: "numeric" }),
        leads: toInt(row.leads_count),
        sold: toInt(row.sold_count)
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => a.t - b.t);

  return {
    title: "Vývoj leadů a prodaných bytů (posledních 6 měsíců)",
    labels: parsed.map((p) => p.label),
    leads: parsed.map((p) => p.leads),
    sold: parsed.map((p) => p.sold)
  };
}
