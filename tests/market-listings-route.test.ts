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

import { GET, POST } from "@/app/api/market-listings/route";

describe("/api/market-listings", () => {
  beforeEach(() => {
    getAuthenticatedUserFromRequestMock.mockReset();
    searchListingsMock.mockReset();
    listSavedListingsMock.mockReset();
  });

  it("GET allows anonymous access and returns paginated payload", async () => {
    getAuthenticatedUserFromRequestMock.mockResolvedValue(null);
    listSavedListingsMock.mockResolvedValue([]);
    searchListingsMock.mockResolvedValue({
      items: [{ id: "listing-1", title: "Byt 2+kk" }],
      total: 17,
      page: 2,
      perPage: 12,
      hasNextPage: true,
      mapBounds: null,
      totalInBounds: null
    });

    const request = new Request(
      "https://example.test/api/market-listings?page=2&perPage=12&source=sreality&offerType=sale&propertyType=apartment&disposition=2%2Bkk&minPrice=3000000&maxPrice=9000000&sort=price_desc"
    );

    const response = await GET(request);
    const body = (await response.json()) as {
      items: Array<{ id: string }>;
      pagination: { page: number; perPage: number; total: number; hasNextPage: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.pagination).toEqual({ page: 2, perPage: 12, total: 17, hasNextPage: true });
    expect(searchListingsMock).toHaveBeenCalledTimes(1);
  });

  it("GET enriches saved flags for authenticated user", async () => {
    getAuthenticatedUserFromRequestMock.mockResolvedValue({ id: "user-1" });
    listSavedListingsMock.mockResolvedValue([{ listingId: "listing-1", savedAt: "2026-01-01", listing: null }]);
    searchListingsMock.mockResolvedValue({
      items: [{ id: "listing-1", title: "Byt 2+kk" }, { id: "listing-2", title: "Byt 3+kk" }],
      total: 2,
      page: 1,
      perPage: 24,
      hasNextPage: false,
      mapBounds: null,
      totalInBounds: null
    });

    const request = new Request("https://example.test/api/market-listings", {
      headers: { Authorization: "Bearer token" }
    });

    const response = await GET(request);
    const body = (await response.json()) as {
      items: Array<{ id: string; isSaved?: boolean }>;
    };

    expect(response.status).toBe(200);
    expect(body.items.find((item) => item.id === "listing-1")?.isSaved).toBe(true);
    expect(body.items.find((item) => item.id === "listing-2")?.isSaved).toBe(false);
  });

  it("POST returns gone for removed legacy flow", async () => {
    const response = await POST();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(410);
    expect(body.error).toContain("removed");
  });
});
