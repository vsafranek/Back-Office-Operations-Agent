import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdminClientMock } = vi.hoisted(() => ({
  getSupabaseAdminClientMock: vi.fn()
}));

vi.mock("@/lib/supabase/server-client", () => ({
  getSupabaseAdminClient: getSupabaseAdminClientMock
}));

import { upsertParsedListings } from "@/lib/integrations/ingestion/upsert-listings";

describe("upsertParsedListings idempotency", () => {
  const listingsUpsert = vi.fn();
  const snapshotsInsert = vi.fn();
  const mediaDeleteEq = vi.fn();
  const mediaInsert = vi.fn();
  const parseResultInsert = vi.fn();

  beforeEach(() => {
    listingsUpsert.mockReset();
    snapshotsInsert.mockReset();
    mediaDeleteEq.mockReset();
    mediaInsert.mockReset();
    parseResultInsert.mockReset();

    listingsUpsert.mockImplementation(() => ({
      select: () => ({
        single: async () => ({ data: { id: "listing-row-1" }, error: null })
      })
    }));

    snapshotsInsert.mockResolvedValue({ error: null });
    mediaDeleteEq.mockResolvedValue({ error: null });
    mediaInsert.mockResolvedValue({ error: null });
    parseResultInsert.mockResolvedValue({ error: null });

    getSupabaseAdminClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "listings") {
          return { upsert: listingsUpsert };
        }
        if (table === "listing_raw_snapshots") {
          return { insert: snapshotsInsert };
        }
        if (table === "listing_media") {
          return {
            delete: () => ({ eq: mediaDeleteEq }),
            insert: mediaInsert
          };
        }
        if (table === "listing_parse_results") {
          return { insert: parseResultInsert };
        }
        throw new Error(`Unexpected table: ${table}`);
      }
    });
  });

  it("uses upsert conflict key and succeeds on repeated runs for same listing", async () => {
    const record = {
      listing: {
        sourceKey: "sreality",
        sourceListingId: "123456789",
        sourceUrl: "https://www.sreality.cz/detail/123456789",
        title: "Prodej bytu 2+kk 58 m2",
        locality: "Praha 2 - Vinohrady",
        currency: "CZK"
      },
      media: [
        {
          mediaUrl: "https://example.test/image.jpg",
          mediaType: "image",
          sortOrder: 0
        }
      ],
      parserName: "deterministic-sreality",
      parserVersion: "1.0.0",
      parsedData: {},
      diagnostics: {},
      rawPayload: { hash_id: 123456789 },
      fetchedAt: "2026-04-13T10:00:00.000Z"
    };

    const first = await upsertParsedListings({ runId: "run-1", records: [record] });
    const second = await upsertParsedListings({ runId: "run-2", records: [record] });

    expect(first.upsertedCount).toBe(1);
    expect(first.failedCount).toBe(0);
    expect(second.upsertedCount).toBe(1);
    expect(second.failedCount).toBe(0);

    expect(listingsUpsert).toHaveBeenCalledTimes(2);
    for (const call of listingsUpsert.mock.calls) {
      expect(call[1]).toEqual({ onConflict: "source_key,source_listing_id" });
    }
  });
});
