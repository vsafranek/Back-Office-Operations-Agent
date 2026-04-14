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

import { GET } from "@/app/api/market-listings/route";

describe("market listings transit filters", () => {
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

  it("forwards near-metro and max metro distance constraints", async () => {
    await GET(
      new Request("https://example.test/api/market-listings?nearMetro=true&maxMetroDistanceM=600")
    );

    expect(searchListingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nearMetro: true,
        maxMetroDistanceM: 600
      })
    );
  });

  it("forwards max metro walking-time constraint", async () => {
    await GET(new Request("https://example.test/api/market-listings?maxMetroWalkMin=12"));

    expect(searchListingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        maxMetroWalkMin: 12
      })
    );
  });

  it("forwards metro line and station filters", async () => {
    await GET(
      new Request(
        "https://example.test/api/market-listings?metroLines=A,C&metroStopIds=550e8400-e29b-41d4-a716-446655440000,550e8400-e29b-41d4-a716-446655440001"
      )
    );

    expect(searchListingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metroLines: ["A", "C"],
        metroStopIds: ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"],
      })
    );
  });

  it("forwards combined transit mode OR matching strategy", async () => {
    await GET(new Request("https://example.test/api/market-listings?transitModes=metro,tram&transitMatchMode=any"));

    expect(searchListingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        transitModes: ["metro", "tram"],
        transitMatchMode: "any"
      })
    );
  });
});
