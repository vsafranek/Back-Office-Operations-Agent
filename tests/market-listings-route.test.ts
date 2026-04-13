import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAuthenticatedUserMock, searchListingsMock } = vi.hoisted(() => ({
  requireAuthenticatedUserMock: vi.fn(),
  searchListingsMock: vi.fn()
}));

vi.mock("@/lib/auth/server-auth", () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock
}));

vi.mock("@/lib/listings/queries", () => ({
  searchListings: searchListingsMock
}));

import { GET, POST } from "@/app/api/market-listings/route";

describe("/api/market-listings", () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockReset();
    searchListingsMock.mockReset();
  });

  it("GET parses filters and returns paginated payload", async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    searchListingsMock.mockResolvedValue({
      items: [{ id: "listing-1", title: "Byt 2+kk" }],
      total: 17,
      page: 2,
      perPage: 12,
      hasNextPage: true
    });

    const request = new Request(
      "https://example.test/api/market-listings?page=2&perPage=12&source=sreality&offerType=sale&propertyType=apartment&disposition=2%2Bkk&minPrice=3000000&maxPrice=9000000&sort=price_desc",
      { headers: { Authorization: "Bearer token" } }
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

  it("POST returns gone for removed legacy flow", async () => {
    const response = await POST();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(410);
    expect(body.error).toContain("removed");
  });
});
