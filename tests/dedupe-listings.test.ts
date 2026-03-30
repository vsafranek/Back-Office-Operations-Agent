import { describe, expect, it } from "vitest";
import { dedupeListingsByExternalId } from "@/lib/market-listings/record-user-market-listing-finds";

describe("dedupeListingsByExternalId", () => {
  it("ponechá jednu položku na external_id, při kolizi vyhrává poslední", () => {
    const base = {
      location: "Praha",
      source: "sreality",
      url: "https://x",
      created_at: "2026-01-01T00:00:00.000Z"
    };
    const out = dedupeListingsByExternalId([
      { external_id: "a", title: "První", ...base },
      { external_id: "b", title: "B", ...base },
      { external_id: "a", title: "Druhý", ...base }
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((x) => x.external_id === "a")?.title).toBe("Druhý");
  });
});
