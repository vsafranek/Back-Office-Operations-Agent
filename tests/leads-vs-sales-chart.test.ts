import { describe, expect, it } from "vitest";
import { buildLeadsVsSalesChart } from "@/lib/agent/analytics/leads-vs-sales-chart";

describe("buildLeadsVsSalesChart", () => {
  it("seřadí měsíce vzestupně a vyplní série", () => {
    const chart = buildLeadsVsSalesChart([
      { month: "2026-02-01", leads_count: 6, sold_count: 2 },
      { month: "2025-10-01", leads_count: 2, sold_count: 0 },
      { month: "2025-12-01", leads_count: 3, sold_count: 1 }
    ]);
    expect(chart.labels).toHaveLength(3);
    expect(chart.leads).toEqual([2, 3, 6]);
    expect(chart.sold).toEqual([0, 1, 2]);
    expect(chart.title).toContain("6 měsíců");
  });

  it("ignoruje neparsovatelný řádek", () => {
    const chart = buildLeadsVsSalesChart([{ month: "x", leads_count: 1, sold_count: 1 }]);
    expect(chart.labels).toHaveLength(0);
  });
});
