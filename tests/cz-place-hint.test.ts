import { describe, expect, it } from "vitest";
import { extractCzPlaceHintForGeocode } from "@/lib/integrations/cz-place-hint";

describe("extractCzPlaceHintForGeocode", () => {
  it("parsuje úsek po „v“", () => {
    expect(extractCzPlaceHintForGeocode("Nabídky v Dačicích")).toBe("Dačicích");
    expect(extractCzPlaceHintForGeocode("byty ve Vysokém Mýtě")).toBe("Vysokém Mýtě");
  });

  it("bez vzoru vrací null", () => {
    expect(extractCzPlaceHintForGeocode("byty ostrava")).toBeNull();
  });
});
