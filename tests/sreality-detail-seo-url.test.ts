import { describe, expect, it } from "vitest";
import { buildSrealityListingDetailUrl } from "@/lib/integrations/sreality-detail-seo-url";

describe("buildSrealityListingDetailUrl", () => {
  it("byt 2+kk", () => {
    expect(
      buildSrealityListingDetailUrl(3870298956, {
        category_main_cb: 1,
        category_sub_cb: 4,
        category_type_cb: 1,
        locality: "praha-strasnice-pocernicka"
      })
    ).toBe("https://www.sreality.cz/detail/prodej/byt/2+kk/praha-strasnice-pocernicka/3870298956");
  });

  it("dum rodinny", () => {
    expect(
      buildSrealityListingDetailUrl(1466581836, {
        category_main_cb: 2,
        category_sub_cb: 37,
        category_type_cb: 1,
        locality: "praha-lochkov-v-oudolku"
      })
    ).toBe("https://www.sreality.cz/detail/prodej/dum/rodinny/praha-lochkov-v-oudolku/1466581836");
  });

  it("pronajem + pozemek (zahrada)", () => {
    expect(
      buildSrealityListingDetailUrl(792941388, {
        category_main_cb: 3,
        category_sub_cb: 23,
        category_type_cb: 2,
        locality: "uholicky-uholicky-bezejmenna"
      })
    ).toBe(
      "https://www.sreality.cz/detail/pronajem/pozemek/zahrada/uholicky-uholicky-bezejmenna/792941388"
    );
  });

  it("vrátí null bez locality", () => {
    expect(
      buildSrealityListingDetailUrl(1, { category_main_cb: 1, category_sub_cb: 2, category_type_cb: 1 })
    ).toBeNull();
  });
});
