import { describe, expect, it } from "vitest";

import { parseListingFiltersFromUrl } from "@/lib/listings/filters";

describe("parseListingFiltersFromUrl", () => {
  it("parses sort/disposition and numeric filters", () => {
    const url = new URL(
      "https://example.test/api/market-listings?page=2&perPage=12&source=sreality,bezrealitky&offerType=sale&propertyType=apartment&disposition=2%2Bkk&minPrice=3000000&maxPrice=8000000&minFloorArea=45&maxFloorArea=120&sort=price_asc"
    );

    const result = parseListingFiltersFromUrl(url);

    expect(result.page).toBe(2);
    expect(result.perPage).toBe(12);
    expect(result.sourceKeys).toEqual(["sreality", "bezrealitky"]);
    expect(result.offerTypes).toEqual(["sale"]);
    expect(result.propertyTypes).toEqual(["apartment"]);
    expect(result.dispositions).toEqual(["2+kk"]);
    expect(result.minPrice).toBe(3000000);
    expect(result.maxPrice).toBe(8000000);
    expect(result.minFloorArea).toBe(45);
    expect(result.maxFloorArea).toBe(120);
    expect(result.sort).toBe("price_asc");
  });

  it("uses defaults for empty query", () => {
    const url = new URL("https://example.test/api/market-listings");
    const result = parseListingFiltersFromUrl(url);

    expect(result.page).toBe(1);
    expect(result.perPage).toBe(24);
    expect(result.sort).toBe("last_seen_desc");
    expect(result.includeInactive).toBe(false);
  });
});
