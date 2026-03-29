import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({
    BEZREALITKY_GRAPHQL_URL: "https://example.test/api/graphql",
    BEZREALITKY_GRAPHQL_QUERY: undefined,
    BEZREALITKY_GRAPHQL_ORIGIN: undefined,
    BEZREALITKY_GRAPHQL_REFERER: undefined
  })
}));

describe("fetchBezrealitkyListings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parsuje data.listAdverts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (): Promise<Response> =>
          ({
            ok: true,
            json: async () => ({
              data: {
                listAdverts: {
                  totalCount: 1,
                  list: [
                    {
                      id: "adv-1",
                      uri: "adv-1-nabidka-test",
                      title: "Byt",
                      price: 5_000_000,
                      surface: 50,
                      mainImage: { url: "https://api.bezrealitky.cz/media/x.jpg" },
                      address: { city: "Praha", street: "Ulice 1" }
                    }
                  ]
                }
              }
            })
          }) as unknown as Response
      )
    );

    const { fetchBezrealitkyListings } = await import("@/lib/integrations/bezrealitky-listings");
    const rows = await fetchBezrealitkyListings({ locationLabel: "Praha" });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.external_id).toBe("bezrealitky:adv-1");
    expect(rows[0]!.source).toBe("bezrealitky");
    expect(rows[0]!.location).toContain("Praha");
    expect(rows[0]!.url).toBe("https://www.bezrealitky.cz/adv-1-nabidka-test");
    expect(rows[0]!.image_url).toContain("bezrealitky.cz");
  });

  it("parsuje data.listSimilarAdverts.list a adresu jako retezec", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (): Promise<Response> =>
          ({
            ok: true,
            json: async () => ({
              data: {
                listSimilarAdverts: {
                  totalCount: 1,
                  list: [
                    {
                      id: "99",
                      uri: "99-test",
                      offerType: "PRONAJEM",
                      estateType: "BYT",
                      disposition: "DISP_2_KK",
                      surface: 48,
                      price: 18_000,
                      address: "Hlavní 1, Plzeň",
                      mainImage: { url: "https://cdn.example/thumb.jpg" }
                    }
                  ]
                }
              }
            })
          }) as unknown as Response
      )
    );

    const { fetchBezrealitkyListings } = await import("@/lib/integrations/bezrealitky-listings");
    const rows = await fetchBezrealitkyListings({ locationLabel: "Plzeňský kraj" });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toContain("PRONAJEM");
    expect(rows[0]!.title).toContain("18");
    expect(rows[0]!.location).toBe("Hlavní 1, Plzeň");
    expect(rows[0]!.external_id).toBe("bezrealitky:99");
  });

  it("autoPaginate: dotáhne další dávky podle totalCount (např. 53 výsledků jako na webu)", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (): Promise<Response> => {
          call += 1;
          if (call === 1) {
            return {
              ok: true,
              json: async () => ({
                data: {
                  listAdverts: {
                    totalCount: 53,
                    list: Array.from({ length: 20 }, (_, i) => ({
                      id: `p1-${i}`,
                      title: "Byt",
                      price: 10_000,
                      surface: 40
                    }))
                  }
                }
              })
            } as unknown as Response;
          }
          if (call === 2) {
            return {
              ok: true,
              json: async () => ({
                data: {
                  listAdverts: {
                    totalCount: 53,
                    list: Array.from({ length: 20 }, (_, i) => ({
                      id: `p2-${i}`,
                      title: "Byt",
                      price: 10_000,
                      surface: 40
                    }))
                  }
                }
              })
            } as unknown as Response;
          }
          return {
            ok: true,
            json: async () => ({
              data: {
                listAdverts: {
                  totalCount: 53,
                  list: Array.from({ length: 13 }, (_, i) => ({
                    id: `p3-${i}`,
                    title: "Byt",
                    price: 10_000,
                    surface: 40
                  }))
                }
              }
            })
          } as unknown as Response;
        }
      )
    );

    const { fetchBezrealitkyListings } = await import("@/lib/integrations/bezrealitky-listings");
    const rows = await fetchBezrealitkyListings({
      autoPaginate: true,
      maxAutoListings: 500,
      variables: { limit: 20, offset: 0, offerType: ["PRONAJEM"], estateType: ["BYT"] }
    });
    expect(rows).toHaveLength(53);
    expect(call).toBe(3);
  });
});
