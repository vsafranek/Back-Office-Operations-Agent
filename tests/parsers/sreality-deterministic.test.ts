import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseSrealityListingDeterministic } from "@/lib/integrations/parsers/deterministic-parser";
import type { SourceListingRecord } from "@/lib/integrations/sources/source-adapter.types";

const fixturePath = resolve(process.cwd(), "tests/parsers/fixtures/sreality-estate-sample.json");

describe("parseSrealityListingDeterministic", () => {
  it("maps Sreality raw payload to canonical listing fields", () => {
    const rawPayload = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;

    const input: SourceListingRecord = {
      sourceKey: "sreality",
      sourceListingId: "123456789",
      sourceUrl: "https://www.sreality.cz/detail/prodej/byt/2+kk/praha-2-vinohrady/123456789",
      fetchedAt: "2026-04-13T10:00:00.000Z",
      rawPayload
    };

    const parsed = parseSrealityListingDeterministic(input);

    expect(parsed).not.toBeNull();
    expect(parsed?.listing.sourceKey).toBe("sreality");
    expect(parsed?.listing.sourceListingId).toBe("123456789");
    expect(parsed?.listing.title).toContain("2+kk");
    expect(parsed?.listing.locality).toBe("Praha 2 - Vinohrady");
    expect(parsed?.listing.priceAmount).toBe(7490000);
    expect(parsed?.listing.offerType).toBe("sale");
    expect(parsed?.listing.propertyType).toBe("apartment");
    expect(parsed?.listing.floorAreaM2).toBe(58);
    expect(parsed?.listing.disposition).toBe("2+kk");
    expect(parsed?.media[0]?.mediaUrl).toContain("https://");
  });
});
