import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAuthenticatedUserMock, listSavedListingsMock, saveListingForUserMock, unsaveListingForUserMock } = vi.hoisted(() => ({
  requireAuthenticatedUserMock: vi.fn(),
  listSavedListingsMock: vi.fn(),
  saveListingForUserMock: vi.fn(),
  unsaveListingForUserMock: vi.fn()
}));

vi.mock("@/lib/auth/server-auth", () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock
}));

vi.mock("@/lib/listings/saved-listings", () => ({
  listSavedListings: listSavedListingsMock,
  saveListingForUser: saveListingForUserMock,
  unsaveListingForUser: unsaveListingForUserMock
}));

import { GET, POST } from "@/app/api/saved-listings/route";
import { DELETE } from "@/app/api/saved-listings/[listingId]/route";

describe("saved listings routes", () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockReset();
    listSavedListingsMock.mockReset();
    saveListingForUserMock.mockReset();
    unsaveListingForUserMock.mockReset();
  });

  it("lists saved listings for authenticated user", async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    listSavedListingsMock.mockResolvedValue([{ listingId: "listing-1", savedAt: "2026-01-01" }]);

    const response = await GET(new Request("https://example.test/api/saved-listings", { headers: { Authorization: "Bearer x" } }));
    const body = (await response.json()) as { items: Array<{ listingId: string }> };

    expect(response.status).toBe(200);
    expect(body.items[0]?.listingId).toBe("listing-1");
  });

  it("saves listing", async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    saveListingForUserMock.mockResolvedValue({ listingId: "listing-1", savedAt: "2026-01-01" });

    const response = await POST(
      new Request("https://example.test/api/saved-listings", {
        method: "POST",
        headers: { Authorization: "Bearer x", "content-type": "application/json" },
        body: JSON.stringify({ listingId: "5f9c56c2-b7ec-4a5f-a584-4d1930d86428" })
      })
    );

    expect(response.status).toBe(201);
  });

  it("deletes saved listing", async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    unsaveListingForUserMock.mockResolvedValue(true);

    const response = await DELETE(new Request("https://example.test/api/saved-listings/x", { method: "DELETE", headers: { Authorization: "Bearer x" } }), {
      params: Promise.resolve({ listingId: "5f9c56c2-b7ec-4a5f-a584-4d1930d86428" })
    });

    expect(response.status).toBe(204);
  });
});
