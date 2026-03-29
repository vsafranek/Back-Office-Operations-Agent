import { describe, expect, it } from "vitest";
import { buildDerivedChartSvg } from "@/lib/agent/analytics/chart-png-svg";
import type { DerivedChartModel } from "@/lib/agent/types";

describe("buildDerivedChartSvg", () => {
  const base = {
    title: "Testovací přehled klientů",
    subtitle: "Graf z týchž řádků jako tabulka.",
    axisLabelX: "Měsíc",
    axisLabelY: "Počet klientů",
    valueUnit: "počet záznamů",
    labels: ["Led", "Úno"],
    values: [3, 5],
    legend: [{ label: "Počet" }],
    rowCountInTable: 8
  };

  it("includes Czech title and axis labels for bar chart", () => {
    const chart: DerivedChartModel = { kind: "bar", ...base };
    const svg = buildDerivedChartSvg(chart);
    expect(svg).toContain("Testovací přehled klientů");
    expect(svg).toContain("Počet klientů");
    expect(svg).toContain("Měsíc");
  });

  it("includes Czech title for pie chart", () => {
    const chart: DerivedChartModel = { kind: "pie", ...base };
    const svg = buildDerivedChartSvg(chart);
    expect(svg).toContain("Testovací přehled klientů");
    expect(svg).toContain("Graf z týchž řádků");
  });

  it("renders dual line chart with legend area", () => {
    const chart: DerivedChartModel = {
      kind: "line",
      ...base,
      series2Values: [1, 2],
      series2Label: "Prodané"
    };
    const svg = buildDerivedChartSvg(chart);
    expect(svg).toContain("Testovací přehled klientů");
    expect(svg).toContain("<path");
  });
});
