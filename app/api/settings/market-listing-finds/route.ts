import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import type { UserMarketListingFindRow } from "@/lib/market-listings/record-user-market-listing-finds";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 120;
const MAX_LIMIT = 300;

/**
 * Uložené nálezy inzerátů (agent, nástroje Nabídky, cron).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, limitRaw ? parseInt(limitRaw, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT)
    );

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_market_listing_finds")
      .select(
        "id, external_id, title, location, source, url, image_url, agent_run_id, first_seen_at, last_seen_at"
      )
      .eq("user_id", user.id)
      .order("last_seen_at", { ascending: false })
      .limit(limit);

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ finds: (data ?? []) as UserMarketListingFindRow[] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Unauthorized") || message.includes("Bearer") ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
