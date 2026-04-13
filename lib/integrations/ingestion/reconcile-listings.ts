import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

type ReconcileScope = {
  sourceKey: string;
  offerType?: string;
  propertyType?: string;
};

type ReconcileInput = {
  scope: ReconcileScope;
  seenSourceListingIds: string[];
};

export async function reconcileMissingListings(input: ReconcileInput): Promise<{ removedCount: number }> {
  const supabase = getSupabaseAdminClient();

  let query = supabase.from("listings").select("id,source_listing_id").eq("source_key", input.scope.sourceKey);

  if (input.scope.offerType) {
    query = query.eq("offer_type", input.scope.offerType);
  }

  if (input.scope.propertyType) {
    query = query.eq("property_type", input.scope.propertyType);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Unable to load existing listings for reconciliation: ${error.message}`);
  }

  const existingRows = (data ?? []) as Array<{ id: string; source_listing_id: string }>;
  const seen = new Set(input.seenSourceListingIds);
  const toDelete = existingRows.filter((row) => !seen.has(row.source_listing_id)).map((row) => row.id);

  if (toDelete.length === 0) {
    return { removedCount: 0 };
  }

  const chunkSize = 500;
  let removedCount = 0;

  for (let i = 0; i < toDelete.length; i += chunkSize) {
    const chunk = toDelete.slice(i, i + chunkSize);

    const { error: deleteSavedError } = await supabase.from("saved_listings").delete().in("listing_id", chunk);
    if (deleteSavedError) {
      throw new Error(`Unable to remove saved-listing references: ${deleteSavedError.message}`);
    }

    const { error: deleteListingsError, count } = await supabase
      .from("listings")
      .delete({ count: "exact" })
      .in("id", chunk);

    if (deleteListingsError) {
      throw new Error(`Unable to delete stale listings: ${deleteListingsError.message}`);
    }

    removedCount += count ?? chunk.length;
  }

  logger.info("listing_reconciliation_removed_missing", {
    sourceKey: input.scope.sourceKey,
    offerType: input.scope.offerType ?? null,
    propertyType: input.scope.propertyType ?? null,
    removedCount
  });

  return { removedCount };
}
