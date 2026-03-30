import { describe, expect, it } from "vitest";
import {
  inferMarketListingsInputFromQuestion,
  MARKET_LISTINGS_INFER_QUESTION_SLICE_MARKER
} from "@/lib/agent/tools/market-listings-infer";

describe("inferMarketListingsInputFromQuestion", () => {
  it("jen Bezrealitky, pronájem, Plzeňský kraj", () => {
    const i = inferMarketListingsInputFromQuestion(
      "Stáhni nabídky z Bezrealitky, zajímají mě byty k pronájmu v Plzeňském kraji"
    );
    expect(i.sources).toEqual(["bezrealitky"]);
    expect(i.bezrealitkyOfferType).toBe("PRONAJEM");
    expect(i.bezrealitkyRegionOsmIds).toEqual(["R442466"]);
    expect(i.srealityLocalityRegionId).toBe(2);
    expect(i.bezrealitkyRegionLabel).toBe("Plzeňský kraj");
    expect(i.srealityOfferKind).toBe("pronajem");
    expect(i.location).toBe("Plzeňský kraj");
  });

  it("bez upřesnění portálu → oba zdroje", () => {
    const i = inferMarketListingsInputFromQuestion("Byty na prodej v Praze");
    expect(i.sources).toEqual(["sreality", "bezrealitky"]);
    expect(i.bezrealitkyRegionOsmIds).toEqual(["R435514"]);
    expect(i.srealityLocalityRegionId).toBe(10);
    expect(i.location).toBe("Praha");
  });

  it("bez lokace v textu → celá ČR (žádný region filtr)", () => {
    const i = inferMarketListingsInputFromQuestion("Byty k prodeji, první stránka");
    expect(i.bezrealitkyRegionOsmIds).toBeUndefined();
    expect(i.srealityLocalityRegionId).toBeUndefined();
    expect(i.location).toBe("Byty k prodeji, první stránka");
  });

  it("Brno → Jihomoravský kraj", () => {
    const i = inferMarketListingsInputFromQuestion("Pronájem bytu v Brně");
    expect(i.bezrealitkyOfferType).toBe("PRONAJEM");
    expect(i.bezrealitkyRegionOsmIds).toEqual(["R442459"]);
    expect(i.srealityLocalityRegionId).toBe(14);
    expect(i.location).toBe("Jihomoravský kraj");
  });

  it("obec mimo tabulku → regionGeocodeHint (Nominatim ve fetchMarketListings)", () => {
    const i = inferMarketListingsInputFromQuestion("Byty k prodeji v Dačicích");
    expect(i.regionGeocodeHint).toBe("Dačicích");
    expect(i.listingLocationNeedle).toBe("Dačicích");
    expect(i.bezrealitkyRegionOsmIds).toBeUndefined();
    expect(i.srealityLocalityRegionId).toBeUndefined();
  });

  it("Plzeň jako město neexpanduje na celý Plzeňský kraj (Nominatim + okres ve fetchMarketListings)", () => {
    const i = inferMarketListingsInputFromQuestion("Byty na prodej v Plzni");
    expect(i.regionGeocodeHint).toBe("Plzni");
    expect(i.listingLocationNeedle).toBe("Plzni");
    expect(i.bezrealitkyRegionOsmIds).toBeUndefined();
    expect(i.srealityLocalityRegionId).toBeUndefined();
  });

  it("přeskočí falešnou lokalitu „infrastruktuře“ z běžné věty a najde další „v …“", () => {
    const i = inferMarketListingsInputFromQuestion(
      "Cron běží v infrastruktuře. Byty na prodej v Plzni"
    );
    expect(i.regionGeocodeHint).toBe("Plzni");
    expect(i.listingLocationNeedle).toBe("Plzni");
  });

  it(`bere jen text za „${MARKET_LISTINGS_INFER_QUESTION_SLICE_MARKER}“ (prefix naplánované úlohy)`, () => {
    const i = inferMarketListingsInputFromQuestion(
      `[Jednorázový běh — cron v infrastruktuře, ne ty.]\n\n${MARKET_LISTINGS_INFER_QUESTION_SLICE_MARKER}\nNabídky v Plzni`
    );
    expect(i.regionGeocodeHint).toBe("Plzni");
    expect(i.location).toBe("Česko");
  });
});
