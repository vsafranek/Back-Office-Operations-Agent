import { createHash } from "node:crypto";

import type { ListingIngestionSummary, UpsertParsedListingInput } from "@/lib/integrations/ingestion/types";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function payloadHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function upsertParsedListings(
  input: {
    runId: string;
    records: UpsertParsedListingInput[];
  }
): Promise<ListingIngestionSummary> {
  const supabase = getSupabaseAdminClient();

  let upsertedCount = 0;
  let failedCount = 0;

  for (const record of input.records) {
    const listingPayload = {
      source_key: record.listing.sourceKey,
      source_listing_id: record.listing.sourceListingId,
      title: record.listing.title,
      description: normalizeText(record.listing.description),
      source_url: record.listing.sourceUrl,
      locality: record.listing.locality,
      city: normalizeText(record.listing.city),
      district: normalizeText(record.listing.district),
      region: normalizeText(record.listing.region),
      country_code: normalizeText(record.listing.countryCode) ?? "CZ",
      latitude: record.listing.latitude ?? null,
      longitude: record.listing.longitude ?? null,
      offer_type: normalizeText(record.listing.offerType),
      property_type: normalizeText(record.listing.propertyType),
      disposition: normalizeText(record.listing.disposition),
      floor_area_m2: record.listing.floorAreaM2 ?? null,
      land_area_m2: record.listing.landAreaM2 ?? null,
      floor_number: record.listing.floorNumber ?? null,
      total_floors: record.listing.totalFloors ?? null,
      price_amount: record.listing.priceAmount ?? null,
      currency: normalizeText(record.listing.currency) ?? "CZK",
      price_note: normalizeText(record.listing.priceNote),
      is_active: record.listing.isActive ?? true,
      published_at: record.listing.publishedAt ?? null,
      metadata: record.listing.metadata ?? {},
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: listingRow, error: listingError } = await supabase
      .from("listings")
      .upsert(listingPayload, { onConflict: "source_key,source_listing_id" })
      .select("id")
      .single();

    if (listingError || !listingRow?.id) {
      failedCount += 1;
      logger.warn("listing_upsert_failed", {
        sourceKey: record.listing.sourceKey,
        sourceListingId: record.listing.sourceListingId,
        message: listingError?.message ?? "missing listing id"
      });
      continue;
    }

    const listingId = listingRow.id as string;

    const { error: snapshotError } = await supabase.from("listing_raw_snapshots").insert({
      listing_id: listingId,
      source_key: record.listing.sourceKey,
      source_listing_id: record.listing.sourceListingId,
      ingestion_run_id: input.runId,
      payload: record.rawPayload,
      payload_hash: payloadHash(record.rawPayload),
      fetched_at: record.fetchedAt
    });

    if (snapshotError) {
      logger.warn("listing_snapshot_insert_failed", {
        listingId,
        message: snapshotError.message
      });
    }

    if (record.media.length > 0) {
      const { error: deleteMediaError } = await supabase.from("listing_media").delete().eq("listing_id", listingId);
      if (deleteMediaError) {
        logger.warn("listing_media_delete_failed", {
          listingId,
          message: deleteMediaError.message
        });
      }

      const mediaRows = record.media.map((media, index) => ({
        listing_id: listingId,
        media_url: media.mediaUrl,
        media_type: normalizeText(media.mediaType) ?? "image",
        sort_order: media.sortOrder ?? index,
        width: media.width ?? null,
        height: media.height ?? null
      }));

      const { error: insertMediaError } = await supabase.from("listing_media").insert(mediaRows);
      if (insertMediaError) {
        logger.warn("listing_media_insert_failed", {
          listingId,
          message: insertMediaError.message
        });
      }
    }

    const { error: parseResultError } = await supabase.from("listing_parse_results").insert({
      listing_id: listingId,
      parser_name: record.parserName,
      parser_version: record.parserVersion,
      confidence: record.confidence ?? null,
      fallback_used: record.fallbackUsed ?? false,
      parsed_data: record.parsedData ?? {},
      diagnostics: record.diagnostics ?? {},
      provenance: record.provenance ?? {},
      enrichment_source: record.enrichmentSource ?? null,
      parsed_at: new Date().toISOString()
    });

    if (parseResultError) {
      logger.warn("listing_parse_result_insert_failed", {
        listingId,
        message: parseResultError.message
      });
    }

    upsertedCount += 1;
  }

  return {
    fetchedCount: input.records.length,
    parsedCount: input.records.length,
    upsertedCount,
    failedCount
  };
}
