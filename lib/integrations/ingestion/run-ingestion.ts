import { createIngestionRun, finalizeIngestionRun } from "@/lib/integrations/ingestion/ingestion-runs";
import { upsertParsedListings } from "@/lib/integrations/ingestion/upsert-listings";
import type { ListingIngestionSummary, UpsertParsedListingInput } from "@/lib/integrations/ingestion/types";
import { parseSrealityListingDeterministic } from "@/lib/integrations/parsers/deterministic-parser";
import { SrealitySourceAdapter, type FetchSrealityAdapterParams } from "@/lib/integrations/sources/sreality-adapter";
import { logger } from "@/lib/observability/logger";

export type RunSrealityIngestionInput = {
  page?: number;
  perPage?: number;
  sourceOptions?: FetchSrealityAdapterParams;
  requestedByUserId?: string | null;
  triggerMode?: "manual" | "scheduled" | "api";
};

export type RunSrealityIngestionResult = ListingIngestionSummary & {
  runId: string;
};

export async function runSrealityIngestion(input: RunSrealityIngestionInput = {}): Promise<RunSrealityIngestionResult> {
  const runId = await createIngestionRun({
    sourceKey: "sreality",
    triggerMode: input.triggerMode ?? "manual",
    requestedByUserId: input.requestedByUserId ?? null,
    metadata: {
      page: input.page ?? 1,
      perPage: input.perPage ?? 60
    }
  });

  try {
    const adapter = new SrealitySourceAdapter(input.sourceOptions);
    const fetched = await adapter.fetchListings({
      page: input.page,
      perPage: input.perPage
    });

    const parsedRecords: UpsertParsedListingInput[] = [];
    for (const record of fetched.records) {
      const parsed = parseSrealityListingDeterministic(record);
      if (!parsed) {
        continue;
      }

      parsedRecords.push({
        ...parsed,
        rawPayload: record.rawPayload,
        fetchedAt: record.fetchedAt
      });
    }

    const persisted = await upsertParsedListings({ runId, records: parsedRecords });

    const summary: ListingIngestionSummary = {
      fetchedCount: fetched.records.length,
      parsedCount: parsedRecords.length,
      upsertedCount: persisted.upsertedCount,
      failedCount: persisted.failedCount + Math.max(0, fetched.records.length - parsedRecords.length)
    };

    const status =
      summary.failedCount === 0
        ? "succeeded"
        : summary.upsertedCount > 0
          ? "partial"
          : "failed";

    await finalizeIngestionRun(runId, {
      status,
      fetchedCount: summary.fetchedCount,
      parsedCount: summary.parsedCount,
      upsertedCount: summary.upsertedCount,
      failedCount: summary.failedCount,
      metadata: {
        totalCountFromSource: fetched.totalCount ?? null
      }
    });

    logger.info("sreality_ingestion_completed", {
      runId,
      status,
      ...summary
    });

    return { runId, ...summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await finalizeIngestionRun(runId, {
      status: "failed",
      fetchedCount: 0,
      parsedCount: 0,
      upsertedCount: 0,
      failedCount: 1,
      errorMessage: message,
      metadata: {}
    });

    logger.error("sreality_ingestion_failed", { runId, message });
    throw error;
  }
}
