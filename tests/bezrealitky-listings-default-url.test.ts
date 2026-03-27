import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({
    BEZREALITKY_GRAPHQL_URL: undefined,
    BEZREALITKY_GRAPHQL_QUERY: undefined,
    BEZREALITKY_GRAPHQL_ORIGIN: undefined,
    BEZREALITKY_GRAPHQL_REFERER: undefined
  })
}));

describe("fetchBezrealitkyListings — výchozí endpoint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    vi.resetModules();
  });

  it("volá https://api.bezrealitky.cz/graphql/ když chybí BEZREALITKY_GRAPHQL_URL", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { listAdverts: { list: [], totalCount: 0 } } })
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { fetchBezrealitkyListings } = await import("@/lib/integrations/bezrealitky-listings");
    await fetchBezrealitkyListings({});

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.bezrealitky.cz/graphql/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Origin: "https://www.bezrealitky.cz",
          Referer: "https://www.bezrealitky.cz/"
        })
      })
    );
  });
});
