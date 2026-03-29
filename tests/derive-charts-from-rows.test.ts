import { describe, expect, it } from "vitest";
import { deriveChartsFromRows } from "@/lib/agent/analytics/derive-charts-from-rows";

describe("deriveChartsFromRows", () => {
  it("returns source channel bar for Q1 when suggested and not narrowed", () => {
    const rows = [
      { source_channel: "Web" },
      { source_channel: "Web" },
      { source_channel: "Sreality" }
    ];
    const charts = deriveChartsFromRows({
      rows,
      preset: "new_clients_q1",
      suggestSourceChannelChart: true,
      suggestDerivedCharts: false,
      rowTextNarrowing: undefined
    });
    expect(charts).toHaveLength(1);
    expect(charts[0]!.kind).toBe("bar");
    const sum = charts[0]!.values.reduce((a, b) => a + b, 0);
    expect(sum).toBe(rows.length);
  });

  it("returns empty for Q1 when text narrowing is set", () => {
    const rows = [{ source_channel: "Web" }];
    const charts = deriveChartsFromRows({
      rows,
      preset: "new_clients_q1",
      suggestSourceChannelChart: true,
      suggestDerivedCharts: false,
      rowTextNarrowing: "Praha"
    });
    expect(charts).toHaveLength(0);
  });

  it("returns dual line for leads_vs_sales_6m", () => {
    const rows = [
      { month: "2025-01-01T00:00:00.000Z", leads_count: 2, sold_count: 1 },
      { month: "2025-02-01T00:00:00.000Z", leads_count: 3, sold_count: 0 }
    ];
    const charts = deriveChartsFromRows({
      rows,
      preset: "leads_vs_sales_6m",
      suggestSourceChannelChart: false,
      suggestDerivedCharts: false
    });
    expect(charts).toHaveLength(1);
    expect(charts[0]!.kind).toBe("line");
    const c = charts[0]!;
    if (c.kind !== "line") throw new Error("expected line");
    expect(c.series2Values?.length).toBe(c.labels.length);
  });

  it("aggregates clients by source_channel with sum equal row count", () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      source_channel: i < 5 ? "A" : "B",
      preferred_city: "Praha"
    }));
    const charts = deriveChartsFromRows({
      rows,
      preset: "clients",
      suggestSourceChannelChart: false,
      suggestDerivedCharts: true
    });
    const byChannel = charts.find((c) => c.title.includes("Zdroj") || c.title.includes("kanál"));
    expect(byChannel).toBeDefined();
    const ch = byChannel!;
    const sum = ch.values.reduce((a, b) => a + b, 0);
    expect(sum).toBe(rows.length);
  });

  it("sorts line categories lexicographically for categorical columns", () => {
    const rows = [
      { source_channel: "Zeta" },
      { source_channel: "Alpha" },
      { source_channel: "Beta" }
    ];
    const charts = deriveChartsFromRows({
      rows,
      preset: "clients",
      suggestSourceChannelChart: false,
      suggestDerivedCharts: true,
      derivedChartKindHint: "line"
    });
    const ch = charts.find((c) => c.kind === "line");
    expect(ch).toBeDefined();
    if (ch?.kind !== "line") return;
    expect(ch.labels[0]).toMatch(/Alpha/i);
  });
});
