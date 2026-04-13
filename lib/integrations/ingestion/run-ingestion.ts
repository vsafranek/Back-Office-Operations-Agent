import {
  buildIngestionStatusFromCounts,
  createIngestionRun,
  finalizeIngestionRun
} from "@/lib/integrations/ingestion/ingestion-runs";
import { reconcileMissingListings } from "@/lib/integrations/ingestion/reconcile-listings";
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
  fullScan?: boolean;
  dryRun?: boolean;
};

export type RunSrealityIngestionResult = ListingIngestionSummary & {
  runId: string;
  status: "succeeded" | "partial" | "failed";
};

function mapOfferType(categoryType?: number): string | undefined {
  if (categoryType === 1) return "sale";
  if (categoryType === 2) return "rent";
  return undefined;
}

function mapPropertyType(categoryMain?: number): string | undefined {
  if (categoryMain === 1) return "apartment";
  if (categoryMain === 2) return "house";
  return undefined;
}

export async function runSrealityIngestion(input: RunSrealityIngestionInput = {}): Promise<RunSrealityIngestionResult> {
  const runId = await createIngestionRun({
    sourceKey: "sreality",
    triggerMode: input.triggerMode ?? "manual",
    requestedByUserId: input.requestedByUserId ?? null,
    metadata: {
      page: input.page ?? 1,
      perPage: input.perPage ?? 60,
      fullScan: input.fullScan ?? false,
      dryRun: input.dryRun ?? false
    }
  });

  try {
    const adapter = new SrealitySourceAdapter({
      ...(input.sourceOptions ?? {}),
      fullScan: input.fullScan ?? input.sourceOptions?.fullScan ?? false
    });

    const fetched = await adapter.fetchListings({
      page: input.page,
      perPage: input.perPage
    });

    const parsedRecords: UpsertParsedListingInput[] = [];
    for (const record of fetched.records) {
      const parsed = parseSrealityListingDeterministic(record);
      if (!parsed) continue;
      parsedRecords.push({
        ...parsed,
        rawPayload: record.rawPayload,
        fetchedAt: record.fetchedAt
      });
    }

    let upsertedCount = 0;
    let upsertFailedCount = 0;
    let removedCount = 0;
    let reconciliationSkippedReason: string | null = null;

    if (!input.dryRun) {
      const persisted = await upsertParsedListings({ runId, records: parsedRecords });
      upsertedCount = persisted.upsertedCount;
      upsertFailedCount = persisted.failedCount;

      const shouldReconcile = Boolean(input.fullScan ?? input.sourceOptions?.fullScan);
      const hasCompleteSnapshot = fetched.diagnostics?.isCompleteSnapshot ?? false;

      if (shouldReconcile && hasCompleteSnapshot) {
        const reconciliation = await reconcileMissingListings({
          scope: {
            sourceKey: "sreality",
            offerType: mapOfferType(input.sourceOptions?.categoryType),
            propertyType: mapPropertyType(input.sourceOptions?.categoryMain)
          },
          seenSourceListingIds: fetched.records.map((record) => record.sourceListingId)
        });
        removedCount = reconciliation.removedCount;
      } else if (shouldReconcile) {
        reconciliationSkippedReason = "reconciliation_skipped_incomplete_snapshot";
        logger.warn("sreality_reconciliation_skipped", {
          runId,
          reason: reconciliationSkippedReason,
          diagnostics: fetched.diagnostics ?? null
        });
      }
    }

    const summary: ListingIngestionSummary = {
      fetchedCount: fetched.records.length,
      parsedCount: parsedRecords.length,
      upsertedCount,
      failedCount: upsertFailedCount + Math.max(0, fetched.records.length - parsedRecords.length),
      removedCount
    };

    const status = buildIngestionStatusFromCounts({
      upsertedCount: summary.upsertedCount,
      failedCount: summary.failedCount
    });

    await finalizeIngestionRun(runId, {
      status,
      fetchedCount: summary.fetchedCount,
      parsedCount: summary.parsedCount,
      upsertedCount: summary.upsertedCount,
      failedCount: summary.failedCount,
      metadata: {
        totalCountFromSource: fetched.totalCount ?? null,
        fullScan: input.fullScan ?? false,
        dryRun: input.dryRun ?? false,
        removedCount,
        diagnostics: fetched.diagnostics ?? null,
        reconciliationSkippedReason
      }
    });

    logger.info("sreality_ingestion_completed", {
      runId,
      status,
      ...summary
    });

    return { runId, status: status as "succeeded" | "partial" | "failed", ...summary };
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
