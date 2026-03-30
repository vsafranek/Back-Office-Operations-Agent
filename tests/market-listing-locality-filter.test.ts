import { describe, expect, it } from "vitest";
import {
  filterMarketListingsByLocalityHint,
  localityContextSearchTokens,
  marketListingMatchesOrNeedles
} from "@/lib/integrations/market-listing-locality-filter";
import type { MarketListing } from "@/lib/agent/tools/market-listing-model";

const base = (partial: Partial<MarketListing> & Pick<MarketListing, "location" | "title">): MarketListing => ({
  external_id: "x:1",
  source: "sreality",
  url: "https://example.com/1",
  created_at: new Date().toISOString(),
  ...partial
});

describe("filterMarketListingsByLocalityHint", () => {
  it("Praha Holešovice: ponechá řádek s Holešovicemi v lokalitě", () => {
    const rows: MarketListing[] = [
      base({ location: "Praha 7, Holešovice", title: "Byt 2+kk" }),
      base({ location: "Praha 4, Chodov", title: "Byt 3+kk" })
    ];
    const { listings, applied } = filterMarketListingsByLocalityHint(rows, "Praha Holešovice");
    expect(applied).toBe(true);
    expect(listings).toHaveLength(1);
    expect(listings[0]!.location).toContain("Holeš");
  });

  it("bez čtvrti v hintu — žádný filtr", () => {
    const rows = [base({ location: "Praha", title: "A" })];
    const { listings, applied, orNeedles } = filterMarketListingsByLocalityHint(rows, "Praha");
    expect(applied).toBe(false);
    expect(orNeedles).toBeNull();
    expect(listings).toHaveLength(1);
  });

  it("fallback když filtr vyřadí vše", () => {
    const rows = [base({ location: "Brno", title: "Byt" })];
    const { listings, applied } = filterMarketListingsByLocalityHint(rows, "Holešovice");
    expect(applied).toBe(false);
    expect(listings).toHaveLength(1);
  });
});

describe("marketListingMatchesOrNeedles", () => {
  it("OR ježky", () => {
    const l = base({ location: "Praha 7", title: "Garsonka" });
    expect(marketListingMatchesOrNeedles(l, ["holesovice", "praha 7"])).toBe(true);
  });
});

describe("localityContextSearchTokens", () => {
  it("rozšíří Karlín o pravidlo čtvrtě", () => {
    const t = localityContextSearchTokens("Karlín");
    expect(t).toContain("karlin");
    expect(t).toContain("praha 8");
  });

  it("Praha bez čtvrtě — jen normovaný text", () => {
    expect(localityContextSearchTokens("Praha")).toEqual(["praha"]);
  });
});
