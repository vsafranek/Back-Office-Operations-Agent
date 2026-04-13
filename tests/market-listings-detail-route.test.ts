import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAuthenticatedUserMock, getListingDetailByIdMock } = vi.hoisted(() => ({
  requireAuthenticatedUserMock: vi.fn(),
  getListingDetailByIdMock: vi.fn()
}));

vi.mock("@/lib/auth/server-auth", () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock
}));

vi.mock("@/lib/listings/queries", () => ({
  getListingDetailById: getListingDetailByIdMock
}));

import { GET } from "@/app/api/market-listings/[id]/route";

describe("GET /api/market-listings/[id]", () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockReset();
    getListingDetailByIdMock.mockReset();
  });

  it("returns detail item when found", async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getListingDetailByIdMock.mockResolvedValue({ id: "listing-123", title: "Byt 2+kk" });

    const request = new Request("https://example.test/api/market-listings/listing-123", {
      headers: { Authorization: "Bearer token" }
    });

    const response = await GET(request, { params: Promise.resolve({ id: "listing-123" }) });
    const body = (await response.json()) as { item?: { id: string } };

    expect(response.status).toBe(200);
    expect(body.item?.id).toBe("listing-123");
    expect(getListingDetailByIdMock).toHaveBeenCalledWith("listing-123");
  });

  it("returns 404 when detail not found", async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getListingDetailByIdMock.mockResolvedValue(null);

    const request = new Request("https://example.test/api/market-listings/missing", {
      headers: { Authorization: "Bearer token" }
    });

    const response = await GET(request, { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
  });
});
