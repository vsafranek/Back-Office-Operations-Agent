import { describe, expect, it } from "vitest";
import { buildBarChartSvg, escapeXmlText } from "@/lib/agent/analytics/chart-png-svg";

describe("escapeXmlText", () => {
  it("escapuje & a závorky", () => {
    expect(escapeXmlText(`a & b <c>`)).toBe("a &amp; b &lt;c&gt;");
  });
});

describe("buildBarChartSvg", () => {
  it("obsahuje titulek a sloupce", () => {
    const svg = buildBarChartSvg({
      title: "Noví klienti — Q1",
      labels: ["Web", "Doporučení"],
      values: [3, 5]
    });
    expect(svg).toContain("Noví klienti");
    expect(svg).toContain("Web");
    expect(svg).toMatch(/>3</);
    expect(svg).toMatch(/>5</);
  });

  it("prázdná data — zpráva", () => {
    const svg = buildBarChartSvg({ title: "T", labels: [], values: [] });
    expect(svg).toContain("Nedostatek dat pro graf");
  });
});
