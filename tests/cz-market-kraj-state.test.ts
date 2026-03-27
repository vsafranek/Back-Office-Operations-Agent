import { describe, expect, it } from "vitest";
import { resolveCzMarketRegionFromKrajState } from "@/lib/integrations/cz-market-regions";

describe("resolveCzMarketRegionFromKrajState", () => {
  it("mapuje název kraje z Nominatim", () => {
    expect(resolveCzMarketRegionFromKrajState("Jihočeský kraj")?.srealityLocalityRegionId).toBe(1);
    expect(resolveCzMarketRegionFromKrajState("Liberecký kraj")?.bezrealitkyRegionOsmIds).toEqual(["R442463"]);
  });

  it("Hlavní město Praha → Praha", () => {
    const r = resolveCzMarketRegionFromKrajState("Hlavní město Praha");
    expect(r?.label).toBe("Praha");
    expect(r?.srealityLocalityRegionId).toBe(10);
  });

  it("prázdný vstup → null", () => {
    expect(resolveCzMarketRegionFromKrajState("")).toBeNull();
    expect(resolveCzMarketRegionFromKrajState(null)).toBeNull();
  });
});
