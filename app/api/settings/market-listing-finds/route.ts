import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import type { UserMarketListingFindRow } from "@/lib/market-listings/record-user-market-listing-finds";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 60;

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Uložené nálezy inzerátů (agent, nástroje Nabídky, cron).
 * Query: page, limit | filtry: location (část textu, ILIKE), source (sreality|bezrealitky), price_min, price_max (Kč, jen řádky s vyplněnou cenou).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || String(DEFAULT_PAGE), 10) || DEFAULT_PAGE);
    const limitRaw = url.searchParams.get("limit");
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, limitRaw ? parseInt(limitRaw, 10) || DEFAULT_PAGE_SIZE : DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const locationQ = url.searchParams.get("location")?.trim();
    const sourceParam = url.searchParams.get("source")?.trim().toLowerCase();
    const source =
      sourceParam === "sreality" || sourceParam === "bezrealitky" ? sourceParam : null;

    const priceMinParsed = parseInt(url.searchParams.get("price_min") ?? "", 10);
    const priceMaxParsed = parseInt(url.searchParams.get("price_max") ?? "", 10);
    const priceMin = Number.isFinite(priceMinParsed) ? priceMinParsed : null;
    const priceMax = Number.isFinite(priceMaxParsed) ? priceMaxParsed : null;

    const supabase = getSupabaseAdminClient();
    let q = supabase
      .from("user_market_listing_finds")
      .select(
        "id, external_id, title, location, source, url, image_url, price_czk, agent_run_id, first_seen_at, last_seen_at",
        { count: "exact" }
      )
      .eq("user_id", user.id);

    if (locationQ && locationQ.length > 0) {
      q = q.ilike("location", `%${escapeIlikePattern(locationQ)}%`);
    }
    if (source) {
      q = q.eq("source", source);
    }
    const priceFilter =
      (priceMin != null && priceMin >= 0) || (priceMax != null && priceMax >= 0);
    if (priceFilter) {
      q = q.not("price_czk", "is", null);
      if (priceMin != null && priceMin >= 0) {
        q = q.gte("price_czk", priceMin);
      }
      if (priceMax != null && priceMax >= 0) {
        q = q.lte("price_czk", priceMax);
      }
    }

    const { data, error, count } = await q.order("last_seen_at", { ascending: false }).range(from, to);

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const total = count ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return Response.json({
      finds: (data ?? []) as UserMarketListingFindRow[],
      total,
      page,
      pageSize,
      totalPages
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Unauthorized") || message.includes("Bearer") ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
