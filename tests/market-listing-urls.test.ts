import { describe, expect, it } from "vitest";
import { pickAbsoluteDetailUrl } from "@/lib/integrations/sreality-listings";

describe("market listing detail URLs", () => {
  it("sreality uses SEO self href when safe (5+ path segments after /detail)", () => {
    const href =
      "https://www.sreality.cz/detail/prodej/dum/rodinny/praha-kosire-lukavskeho/38548300";
    expect(
      pickAbsoluteDetailUrl(
        { hash_id: 38548300, _links: { self: { href } } },
        38548300
      )
    ).toBe(href);
  });

  it("sreality: z seo složí /detail/… před API self odkazem", () => {
    expect(
      pickAbsoluteDetailUrl(
        {
          hash_id: 52642636,
          seo: {
            category_main_cb: 2,
            category_sub_cb: 37,
            category_type_cb: 1,
            locality: "praha-chodov-medkova"
          },
          _links: { self: { href: "https://www.sreality.cz/cs/v2/estates/52642636" } }
        },
        52642636
      )
    ).toBe("https://www.sreality.cz/detail/prodej/dum/rodinny/praha-chodov-medkova/52642636");
  });

  it("sreality resolves relative public /detail/… when SEO-shaped", () => {
    expect(
      pickAbsoluteDetailUrl(
        {
          hash_id: 1,
          _links: { self: { href: "/detail/prodej/byty/2-1/praha-test-ulice/123" } }
        },
        1
      )
    ).toBe("https://www.sreality.cz/detail/prodej/byty/2-1/praha-test-ulice/123");
  });

  it("sreality falls back to ?detail= (short /detail/{id} is not used)", () => {
    expect(pickAbsoluteDetailUrl({ hash_id: 42 }, 42)).toBe("https://www.sreality.cz/?detail=42");
  });

  it("bezrealitky-style URL: relative path from API gets origin", () => {
    const uri = "nemovitosti-byty-domy/inzerat/abc-123";
    const url =
      uri.startsWith("http") ? uri : uri ? `https://www.bezrealitky.cz/${uri.replace(/^\//, "")}` : "";
    expect(url).toBe(`https://www.bezrealitky.cz/${uri}`);
  });
});
