import type { MarketListing } from "@/lib/agent/tools/market-listing-model";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

const MAX_PER_CALL = 120;

/**
 * Uloží nebo aktualizuje nálezy inzerátů pro uživatele (první / poslední výskyt).
 * Volá se z běhu agenta, cronu nebo POST /api/market-listings.
 */
export async function recordUserMarketListingFinds(params: {
  userId: string;
  agentRunId: string | null;
  listings: MarketListing[];
}): Promise<void> {
  const slice = params.listings.slice(0, MAX_PER_CALL);
  if (slice.length === 0) return;

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  for (const l of slice) {
    try {
      const { data: existing, error: selErr } = await supabase
        .from("user_market_listing_finds")
        .select("id")
        .eq("user_id", params.userId)
        .eq("external_id", l.external_id)
        .maybeSingle();

      if (selErr) {
        logger.warn("user_market_listing_find_select_failed", { message: selErr.message });
        continue;
      }

      const base = {
        title: l.title,
        location: l.location,
        source: l.source,
        url: l.url,
        image_url: l.image_url ?? null,
        last_seen_at: now
      };

      if (existing?.id) {
        const upd: Record<string, unknown> = { ...base };
        if (params.agentRunId) {
          upd.agent_run_id = params.agentRunId;
        }
        const { error: upErr } = await supabase.from("user_market_listing_finds").update(upd).eq("id", existing.id);
        if (upErr) {
          logger.warn("user_market_listing_find_update_failed", { externalId: l.external_id, message: upErr.message });
        }
      } else {
        const { error: insErr } = await supabase.from("user_market_listing_finds").insert({
          user_id: params.userId,
          external_id: l.external_id,
          ...base,
          agent_run_id: params.agentRunId,
          first_seen_at: now
        });
        if (insErr) {
          logger.warn("user_market_listing_find_insert_failed", { externalId: l.external_id, message: insErr.message });
        }
      }
    } catch (e) {
      logger.warn("user_market_listing_find_row_failed", {
        externalId: l.external_id,
        message: e instanceof Error ? e.message : String(e)
      });
    }
  }
}

export type UserMarketListingFindRow = {
  id: string;
  external_id: string;
  title: string;
  location: string;
  source: string;
  url: string;
  image_url: string | null;
  agent_run_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
};
