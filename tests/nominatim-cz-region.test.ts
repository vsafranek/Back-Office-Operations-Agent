import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCzMarketRegionFromNominatim } from "@/lib/integrations/nominatim-cz-region";

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
});
