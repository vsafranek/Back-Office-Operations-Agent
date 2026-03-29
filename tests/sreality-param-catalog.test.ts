import { describe, expect, it } from "vitest";
import {
  SREALITY_REGIONS_CR,
  srealityCategorySubForMain,
  srealityDistrictSelectData,
  srealityRegionSelectData
} from "@/lib/integrations/sreality-param-catalog";

describe("sreality-param-catalog", () => {
  it("obsahuje 14 krajů a unikátní ID", () => {
    expect(SREALITY_REGIONS_CR).toHaveLength(14);
    const ids = new Set(SREALITY_REGIONS_CR.map((r) => r.id));
    expect(ids.size).toBe(14);
  });

  it("srealityRegionSelectData má hodnoty jako řetězce ID", () => {
    const plzen = srealityRegionSelectData().find((o) => o.value === "2");
    expect(plzen?.label).toContain("Plzeň");
  });

  it("okresy jsou abecedně seřazené (cs)", () => {
    const data = srealityDistrictSelectData();
    expect(data.length).toBeGreaterThan(70);
    const labels = data.map((d) => d.label);
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, "cs"));
    expect(labels).toEqual(sorted);
  });

  it("category_sub: byty vs domy", () => {
    expect(srealityCategorySubForMain(1).some((x) => x.id === 4 && x.label.includes("2+kk"))).toBe(true);
    expect(srealityCategorySubForMain(2).some((x) => x.id === 37)).toBe(true);
  });
});
