import type { CanonicalListingInput, ParsedListingInput } from "@/lib/integrations/ingestion/types";
import type { SourceListingRecord } from "@/lib/integrations/sources/source-adapter.types";

export type LlmEnrichmentCandidate = {
  confidence: number;
  fields?: Partial<CanonicalListingInput>;
  parsedData?: Record<string, unknown>;
  diagnostics?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
};

export type LlmEnrichmentParams = {
  record: SourceListingRecord;
  base: ParsedListingInput;
  infer: (input: {
    title: string;
    description: string | null;
    locality: string;
    rawPayload: Record<string, unknown>;
  }) => Promise<LlmEnrichmentCandidate | null>;
  minConfidence?: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export async function parseListingWithLlmEnrichment(params: LlmEnrichmentParams): Promise<ParsedListingInput> {
  const minConfidence = params.minConfidence ?? 0.65;

  const result = await params.infer({
    title: params.base.listing.title,
    description: params.base.listing.description ?? null,
    locality: params.base.listing.locality,
    rawPayload: params.record.rawPayload
  });

  if (!result) {
    return {
      ...params.base,
      fallbackUsed: true,
      enrichmentSource: "llm",
      diagnostics: {
        ...(params.base.diagnostics ?? {}),
        llmEnrichment: "no-result"
      },
      provenance: {
        ...(params.base.provenance ?? {}),
        llm: { used: false, reason: "no-result" }
      }
    };
  }

  const confidence = clamp01(result.confidence);
  if (confidence < minConfidence) {
    return {
      ...params.base,
      confidence: params.base.confidence ?? confidence,
      fallbackUsed: true,
      enrichmentSource: "llm",
      diagnostics: {
        ...(params.base.diagnostics ?? {}),
        llmEnrichment: "low-confidence",
        llmConfidence: confidence,
        ...(result.diagnostics ?? {})
      },
      provenance: {
        ...(params.base.provenance ?? {}),
        llm: {
          used: false,
          reason: "low-confidence",
          confidence,
          ...(result.provenance ?? {})
        }
      }
    };
  }

  return {
    ...params.base,
    listing: {
      ...params.base.listing,
      ...(result.fields ?? {})
    },
    parserName: `${params.base.parserName}+llm`,
    parserVersion: params.base.parserVersion,
    confidence,
    fallbackUsed: false,
    enrichmentSource: "llm",
    parsedData: {
      ...(params.base.parsedData ?? {}),
      ...(result.parsedData ?? {})
    },
    diagnostics: {
      ...(params.base.diagnostics ?? {}),
      llmEnrichment: "applied",
      llmConfidence: confidence,
      ...(result.diagnostics ?? {})
    },
    provenance: {
      ...(params.base.provenance ?? {}),
      llm: {
        used: true,
        confidence,
        ...(result.provenance ?? {})
      }
    }
  };
}
