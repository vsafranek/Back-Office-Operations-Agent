import { describe, expect, it } from "vitest";

import { parseListingFiltersFromUrl } from "@/lib/listings/filters";

describe("split view filter sync", () => {
  it("parses map bounds and paging consistently", () => {
    const filters = parseListingFiltersFromUrl(
      new URL("https://example.test/api/market-listings?page=2&perPage=24&north=50&south=49&east=15&west=14")
    );

    expect(filters.page).toBe(2);
    expect(filters.perPage).toBe(24);
    expect(filters.bounds).toEqual({ north: 50, south: 49, east: 15, west: 14 });
  });
});
