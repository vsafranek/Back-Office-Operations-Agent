import { describe, expect, it } from "vitest";

import type { ParsedListingInput } from "@/lib/integrations/ingestion/types";
import { parseListingWithLlmEnrichment } from "@/lib/integrations/parsers/llm-enrichment-parser";
import type { SourceListingRecord } from "@/lib/integrations/sources/source-adapter.types";

const baseParsed: ParsedListingInput = {
  listing: {
    sourceKey: "sreality",
    sourceListingId: "id-1",
    sourceUrl: "https://example.com/listing/id-1",
    title: "Byt 2+kk",
    locality: "Praha",
    countryCode: "CZ"
  },
  media: [],
  parserName: "deterministic-sreality",
  parserVersion: "1.0.0",
  confidence: 0.82,
  fallbackUsed: false,
  parsedData: { title: "Byt 2+kk" },
  diagnostics: {},
  provenance: { extraction: "deterministic-rules" },
  enrichmentSource: null
};

const record: SourceListingRecord = {
  sourceKey: "sreality",
  sourceListingId: "id-1",
  sourceUrl: "https://example.com/listing/id-1",
  fetchedAt: "2026-04-13T10:00:00.000Z",
  rawPayload: { name: "Byt 2+kk Praha" }
};

describe("parseListingWithLlmEnrichment", () => {
  it("applies enrichment when confidence is high", async () => {
    const result = await parseListingWithLlmEnrichment({
      record,
      base: baseParsed,
      infer: async () => ({
        confidence: 0.91,
        fields: { city: "Praha" },
        parsedData: { city: "Praha" },
        provenance: { model: "mock-llm" }
      })
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.enrichmentSource).toBe("llm");
    expect(result.listing.city).toBe("Praha");
    expect(result.provenance?.llm).toMatchObject({ used: true });
  });

  it("falls back to base parsing for low-confidence output", async () => {
    const result = await parseListingWithLlmEnrichment({
      record,
      base: baseParsed,
      minConfidence: 0.7,
      infer: async () => ({
        confidence: 0.42,
        fields: { city: "Brno" }
      })
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.listing.city).toBeUndefined();
    expect(result.diagnostics?.llmEnrichment).toBe("low-confidence");
    expect(result.provenance?.llm).toMatchObject({ used: false, reason: "low-confidence" });
  });
});
