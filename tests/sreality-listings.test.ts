import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSrealityListings } from "@/lib/integrations/sreality-listings";

describe("fetchSrealityListings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mapuje _embedded.estates na MarketListing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (): Promise<Response> =>
          ({
            ok: true,
            json: async () => ({
              _embedded: {
                estates: [
                  {
                    hash_id: 123,
                    name: "Prodej bytu 2+kk",
                    locality: "Testovací, Praha",
                    price_czk: { value_raw: 5_500_000 },
                    seo: {
                      category_main_cb: 1,
                      category_sub_cb: 4,
                      category_type_cb: 1,
                      locality: "praha-test-ulice"
                    },
                    _links: {
                      self: { href: "/cs/v2/estates/123" },
                      images: [{ href: "https://cdn.example.test/preview.jpg" }]
                    }
                  }
                ]
              }
            })
          }) as unknown as Response
      )
    );

    const rows = await fetchSrealityListings({
      categoryMain: 1,
      categoryType: 1,
      localityRegionId: 10,
      page: 1,
      perPage: 10
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.external_id).toBe("sreality:123");
    expect(rows[0]!.source).toBe("sreality");
    expect(rows[0]!.title).toContain("2+kk");
    expect(rows[0]!.title).toContain("Kč");
    expect(rows[0]!.url).toBe("https://www.sreality.cz/detail/prodej/byt/2+kk/praha-test-ulice/123");
    expect(rows[0]!.image_url).toBe("https://cdn.example.test/preview.jpg");
  });

  it("bez locality_region_id neposílá parametr v URL", async () => {
    const fetchMock = vi.fn(
      async (url: string): Promise<Response> =>
        ({
          ok: true,
          json: async () => ({ _embedded: { estates: [] } })
        }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchSrealityListings({
      categoryMain: 1,
      categoryType: 1,
      page: 1,
      perPage: 5
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0]![0] as string;
    expect(calledUrl).not.toContain("locality_region_id");
  });

  it("přidá category_sub_cb do dotazu", async () => {
    const fetchMock = vi.fn(
      async (url: string): Promise<Response> =>
        ({
          ok: true,
          json: async () => ({ _embedded: { estates: [] } })
        }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchSrealityListings({
      categoryMain: 1,
      categoryType: 1,
      categorySubCb: 4,
      page: 1,
      perPage: 5
    });

    const calledUrl = fetchMock.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("category_sub_cb=4");
  });

  it("při HTTP chybě vrací prázdné pole", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (): Promise<Response> =>
          ({
            ok: false,
            status: 503,
            json: async () => ({})
          }) as unknown as Response
      )
    );

    const rows = await fetchSrealityListings({
      categoryMain: 1,
      categoryType: 1,
      localityRegionId: 10,
      page: 1,
      perPage: 5
    });
    expect(rows).toEqual([]);
  });
});
