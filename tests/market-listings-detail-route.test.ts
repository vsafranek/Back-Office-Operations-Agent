import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedUserFromRequestMock, getListingDetailByIdMock, listSavedListingsMock } = vi.hoisted(() => ({
  getAuthenticatedUserFromRequestMock: vi.fn(),
  getListingDetailByIdMock: vi.fn(),
  listSavedListingsMock: vi.fn()
}));

vi.mock("@/lib/auth/server-auth", () => ({
  getAuthenticatedUserFromRequest: getAuthenticatedUserFromRequestMock
}));

vi.mock("@/lib/listings/queries", () => ({
  getListingDetailById: getListingDetailByIdMock
}));

vi.mock("@/lib/listings/saved-listings", () => ({
  listSavedListings: listSavedListingsMock
}));

import { GET } from "@/app/api/market-listings/[id]/route";

describe("GET /api/market-listings/[id]", () => {
  beforeEach(() => {
    getAuthenticatedUserFromRequestMock.mockReset();
    getListingDetailByIdMock.mockReset();
    listSavedListingsMock.mockReset();
  });

  it("returns detail item when found for anonymous", async () => {
    getAuthenticatedUserFromRequestMock.mockResolvedValue(null);
    getListingDetailByIdMock.mockResolvedValue({ id: "listing-123", title: "Byt 2+kk" });

    const request = new Request("https://example.test/api/market-listings/listing-123");

    const response = await GET(request, { params: Promise.resolve({ id: "listing-123" }) });
    const body = (await response.json()) as { item?: { id: string; isSaved?: boolean } };

    expect(response.status).toBe(200);
    expect(body.item?.id).toBe("listing-123");
    expect(body.item?.isSaved).toBe(false);
    expect(getListingDetailByIdMock).toHaveBeenCalledWith("listing-123");
  });

  it("returns saved flag for authenticated user", async () => {
    getAuthenticatedUserFromRequestMock.mockResolvedValue({ id: "user-1" });
    getListingDetailByIdMock.mockResolvedValue({ id: "listing-123", title: "Byt 2+kk" });
    listSavedListingsMock.mockResolvedValue([{ listingId: "listing-123", savedAt: "2026-01-01", listing: null }]);

    const request = new Request("https://example.test/api/market-listings/listing-123", {
      headers: { Authorization: "Bearer token" }
    });

    const response = await GET(request, { params: Promise.resolve({ id: "listing-123" }) });
    const body = (await response.json()) as { item?: { isSaved?: boolean } };

    expect(response.status).toBe(200);
    expect(body.item?.isSaved).toBe(true);
  });

  it("returns 404 when detail not found", async () => {
    getAuthenticatedUserFromRequestMock.mockResolvedValue(null);
    getListingDetailByIdMock.mockResolvedValue(null);

    const request = new Request("https://example.test/api/market-listings/missing");

    const response = await GET(request, { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
  });
});
