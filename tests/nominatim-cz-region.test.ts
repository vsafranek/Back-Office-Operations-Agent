import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveCzMarketLocationFromNominatim,
  resolveCzMarketRegionFromNominatim
} from "@/lib/integrations/nominatim-cz-region";

describe("resolveCzMarketRegionFromNominatim", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("z address.state odvodí kraj", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (): Promise<Response> =>
          ({
            ok: true,
            json: async () => [
              {
                address: { state: "Jihočeský kraj", village: "Dačice" }
              }
            ]
          }) as unknown as Response
      )
    );

    const r = await resolveCzMarketRegionFromNominatim({
      q: "Dačice",
      userAgent: "Vitest/1.0 (test)",
      timeoutMs: 5000
    });
    expect(r?.label).toBe("Jihočeský kraj");
    expect(r?.srealityLocalityRegionId).toBe(1);
  });

  it("prázdná odpověď → null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (): Promise<Response> =>
          ({
            ok: true,
            json: async () => []
          }) as unknown as Response
      )
    );
    const r = await resolveCzMarketRegionFromNominatim({
      q: "xyznonexist",
      userAgent: "Vitest/1.0 (test)",
      timeoutMs: 5000
    });
    expect(r).toBeNull();
  });

  it("Plzeň z Nominatim → užší lokalita (okres) místo celého kraje", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (): Promise<Response> =>
          ({
            ok: true,
            json: async () => [
              {
                address: { state: "Plzeňský kraj", city: "Plzeň" }
              }
            ]
          }) as unknown as Response
      )
    );

    const r = await resolveCzMarketLocationFromNominatim({
      q: "Plzni",
      userAgent: "Vitest/1.0 (test)",
      timeoutMs: 5000
    });
    expect(r?.scope).toBe("locality");
    if (r?.scope === "locality") {
      expect(r.srealityLocalityDistrictId).toBe(12);
      expect(r.listingLocationNeedle).toBe("Plzeň");
      expect(r.region.label).toBe("Plzeňský kraj");
    }
  });
});
