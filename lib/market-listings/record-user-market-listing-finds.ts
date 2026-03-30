import { filterMarketListingsWithPreviewImage, type MarketListing } from "@/lib/agent/tools/market-listing-model";
import { normCs } from "@/lib/integrations/cz-market-regions";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

const MAX_PER_CALL = 120;
const UPSERT_BATCH = 80;

/** Jedna položka na external_id (poslední výskyt ve vstupu vyhrává). */
export function dedupeListingsByExternalId(listings: MarketListing[]): MarketListing[] {
  const map = new Map<string, MarketListing>();
  for (const l of listings) {
    const id = l.external_id?.trim();
    if (!id) continue;
    map.set(id, l);
  }
  return [...map.values()];
}

/**
 * Uloží nebo aktualizuje nálezy inzerátů pro uživatele (první / poslední výskyt).
 * Stejný `(user_id, external_id)` se neuloží dvakrát — jeden atomický upsert na řádek + deduplikace vstupu.
 * `first_seen_at` se u existujícího řádku nemění (sloupec v upsertu neposíláme).
 * Stejný filtr náhledu jako u `fetchMarketListings` (pro jistotu i u vstupu mimo fetch).
 */
export async function recordUserMarketListingFinds(params: {
  userId: string;
  agentRunId: string | null;
  listings: MarketListing[];
}): Promise<void> {
  const unique = dedupeListingsByExternalId(filterMarketListingsWithPreviewImage(params.listings)).slice(
    0,
    MAX_PER_CALL
  );
  if (unique.length === 0) return;

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const rows = unique.map((l) => {
    const row: Record<string, unknown> = {
      user_id: params.userId,
      external_id: l.external_id.trim(),
      title: l.title,
      location: l.location,
      location_context: normCs(`${l.title} ${l.location}`),
      source: l.source,
      url: l.url,
      image_url: l.image_url ?? null,
      price_czk: l.price_czk ?? null,
      last_seen_at: now
    };
    if (params.agentRunId) {
      row.agent_run_id = params.agentRunId;
    }
    return row;
  });

  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const chunk = rows.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase.from("user_market_listing_finds").upsert(chunk, {
      onConflict: "user_id,external_id"
    });
    if (error) {
      logger.warn("user_market_listing_finds_upsert_failed", {
        batchStart: i,
        count: chunk.length,
        message: error.message
      });
    }
  }
}

export type UserMarketListingFindRow = {
  id: string;
  external_id: string;
  title: string;
  location: string;
  /** normCs(title + location) — uložené pro kontextové filtrování lokality */
  location_context: string | null;
  source: string;
  url: string;
  image_url: string | null;
  price_czk: number | null;
  agent_run_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
};
