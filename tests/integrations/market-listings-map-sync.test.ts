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

describe("market-listings bounds synchronization", () => {
  beforeEach(() => {
    getAuthenticatedUserFromRequestMock.mockReset();
    searchListingsMock.mockReset();
    listSavedListingsMock.mockReset();
  });

  it("forwards bbox bounds to listing query", async () => {
    getAuthenticatedUserFromRequestMock.mockResolvedValue(null);
    listSavedListingsMock.mockResolvedValue([]);
    searchListingsMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      perPage: 24,
      hasNextPage: false,
      mapBounds: { north: 50.1, south: 49.9, east: 14.7, west: 14.3 },
      totalInBounds: 0
    });

    const response = await GET(
      new Request(
        "https://example.test/api/market-listings?north=50.1&south=49.9&east=14.7&west=14.3&propertyType=apartment"
      )
    );

    expect(response.status).toBe(200);
    expect(searchListingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bounds: {
          north: 50.1,
          south: 49.9,
          east: 14.7,
          west: 14.3
        }
      })
    );
  });
});
