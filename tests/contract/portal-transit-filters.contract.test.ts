import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedUserFromRequestMock, searchListingsMock, listSavedListingsMock } = vi.hoisted(() => ({
  getAuthenticatedUserFromRequestMock: vi.fn(),
  searchListingsMock: vi.fn(),
  listSavedListingsMock: vi.fn()
}));

vi.mock("@/lib/auth/server-auth", () => ({
  getAuthenticatedUserFromRequest: getAuthenticatedUserFromRequestMock
}));

vi.mock("@/lib/listings/queries", () => ({
  searchListings: searchListingsMock
}));

vi.mock("@/lib/listings/saved-listings", () => ({
  listSavedListings: listSavedListingsMock
}));

import { GET as getListings } from "@/app/api/market-listings/route";
import { GET as getTransitStops } from "@/app/api/transit/stops/route";

describe("portal-transit-filters contract", () => {
  beforeEach(() => {
    getAuthenticatedUserFromRequestMock.mockReset();
    searchListingsMock.mockReset();
    listSavedListingsMock.mockReset();
    getAuthenticatedUserFromRequestMock.mockResolvedValue(null);
    listSavedListingsMock.mockResolvedValue([]);
    searchListingsMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      perPage: 24,
      hasNextPage: false,
      mapBounds: null,
      totalInBounds: null
    });
  });

  it("exposes expected route handlers", () => {
    expect(typeof getListings).toBe("function");
    expect(typeof getTransitStops).toBe("function");
  });

  it("accepts transit query params on GET /api/market-listings", async () => {
    const response = await getListings(
      new Request(
        "https://example.test/api/market-listings?nearMetro=true&maxMetroDistanceM=600&maxMetroWalkMin=10&metroLines=A,B&metroStopIds=550e8400-e29b-41d4-a716-446655440000&transitModes=metro,tram&transitMatchMode=all&minTransitScore=70"
      )
    );

    expect(response.status).toBe(200);
    expect(searchListingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nearMetro: true,
        maxMetroDistanceM: 600,
        maxMetroWalkMin: 10,
        metroLines: ["A", "B"],
        metroStopIds: ["550e8400-e29b-41d4-a716-446655440000"],
        transitModes: ["metro", "tram"],
        transitMatchMode: "all",
        minTransitScore: 70
      })
    );
  });
});
