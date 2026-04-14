import { describe, expect, it } from "vitest";

import { parseListingFiltersFromUrl } from "@/lib/listings/filters";

describe("transit filter map/list sync", () => {
  it("parses transit filters alongside bbox parameters", () => {
    const filters = parseListingFiltersFromUrl(
      new URL(
        "https://example.test/api/market-listings?north=50.1&south=49.8&east=14.8&west=14.2&nearMetro=true&maxMetroDistanceM=500&maxMetroWalkMin=8&minTransitScore=55&metroLines=A,C&transitModes=metro,tram&transitMatchMode=any"
      )
    );

    expect(filters.bounds).toEqual({ north: 50.1, south: 49.8, east: 14.8, west: 14.2 });
    expect(filters.nearMetro).toBe(true);
    expect(filters.maxMetroDistanceM).toBe(500);
    expect(filters.maxMetroWalkMin).toBe(8);
    expect(filters.minTransitScore).toBe(55);
    expect(filters.metroLines).toEqual(["A", "C"]);
    expect(filters.transitModes).toEqual(["metro", "tram"]);
    expect(filters.transitMatchMode).toBe("any");
  });
});
