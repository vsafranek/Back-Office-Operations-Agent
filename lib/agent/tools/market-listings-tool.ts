import { fetchBezrealitkyListings } from "@/lib/integrations/bezrealitky-listings";
import { fetchSrealityListings } from "@/lib/integrations/sreality-listings";
import { normCs } from "@/lib/integrations/cz-market-regions";
import { resolveCzMarketRegionFromNominatim } from "@/lib/integrations/nominatim-cz-region";
import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { z } from "zod";
import { MarketListingSchema, type MarketListing } from "@/lib/agent/tools/market-listing-model";

export { MarketListingSchema, type MarketListing } from "@/lib/agent/tools/market-listing-model";

const MarketSourceSchema = z.enum(["sreality", "bezrealitky"]);

export const FetchMarketListingsInputSchema = z.object({
  location: z
    .string()
    .min(1)
    .default("Česko")
    .describe("Krátká lokace pro štítky a region (např. Brno, Plzeňský kraj). Neposílej celý uživatelský dotaz větou."),
  sources: z
    .array(MarketSourceSchema)
    .default(["sreality", "bezrealitky"])
    .describe('Když uživatel chce jen jeden portál: např. ["bezrealitky"] nebo ["sreality"].'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(60),
  /** Sreality: např. 10 = Praha. Bez hodnoty = bez filtru regionu (celá ČR). */
  srealityLocalityRegionId: z.coerce.number().int().optional(),
  /** Užší městská část — pouze pokud znáš ID z Sreality */
  srealityLocalityDistrictId: z.coerce.number().int().optional(),
  /** Sreality API: 1 = prodej, 2 = pronájem */
  srealityOfferKind: z.enum(["prodej", "pronajem"]).default("prodej"),
  /** Sreality category_main_cb: 1 = byty, 2 = domy */
  srealityCategoryMain: z.union([z.literal(1), z.literal(2)]).optional(),
  /** Sreality `category_sub_cb` — dispozice bytu nebo typ domu (viz sreality-param-catalog). */
  srealityCategorySubCb: z.coerce.number().int().optional(),
  /** Bezrealitky GraphQL enum OfferType */
  bezrealitkyOfferType: z.enum(["PRODEJ", "PRONAJEM"]).optional(),
  /** Bezrealitky GraphQL listAdverts.regionOsmIds (prefix R…). Prázdné / vynecháno = celá ČR. */
  bezrealitkyRegionOsmIds: z.array(z.string().min(1)).optional(),
  /** Štítek regionu pro karty / log (volitelně). */
  bezrealitkyRegionLabel: z.string().max(120).optional(),
  /**
   * Krátký úsek z dotazu (např. obec po „v …“) pro Nominatim — když není ručně nastavený kraj.
   */
  regionGeocodeHint: z.string().max(80).optional()
});

/** Uložené u cron úlohy — částečná shoda s fetch vstupem. */
export const StoredMarketListingsParamsSchema = FetchMarketListingsInputSchema.partial();

export function mergeStoredMarketListingsParams(stored: unknown): z.infer<typeof FetchMarketListingsInputSchema> | null {
  const partial = StoredMarketListingsParamsSchema.safeParse(stored);
  if (!partial.success) return null;
  const full = FetchMarketListingsInputSchema.safeParse({
    location: partial.data.location ?? "Česko",
    sources: partial.data.sources?.length ? partial.data.sources : (["sreality", "bezrealitky"] as const),
    page: partial.data.page ?? 1,
    perPage: partial.data.perPage ?? 24,
    srealityOfferKind: partial.data.srealityOfferKind ?? "prodej",
    ...partial.data
  });
  return full.success ? full.data : null;
}

export type FetchMarketListingsInput = z.infer<typeof FetchMarketListingsInputSchema>;

export const FetchMarketListingsOutputSchema = z.array(MarketListingSchema);

function bezrealitkyLocationLabel(input: z.infer<typeof FetchMarketListingsInputSchema>): string {
  const label = input.bezrealitkyRegionLabel?.trim();
  if (label) return label;
  const loc = input.location.trim();
  if (loc.length <= 72 && !/\b(stáhni|zajím|zajima|nabídk|chci|potřeb|dotaz)\b/i.test(loc)) {
    return loc;
  }
  return "Česko";
}

function shouldTryNominatimSeed(seed: string, fromExtractedHint: boolean): boolean {
  const t = seed.trim();
  if (!t) return false;
  if (normCs(t) === normCs("Česko")) return false;
  if (/^(česko|čr|cr|czech republic|česká republika|ceska republika)\b/i.test(t)) return false;
  if (/\b(stránk|strana)\b/i.test(t)) return false;
  if (fromExtractedHint && t.length <= 80) return true;
  if (t.length > 72) return false;
  return t.split(/\s+/).length <= 6;
}

async function maybeResolveRegionViaNominatim(
  input: z.infer<typeof FetchMarketListingsInputSchema>,
  env: ReturnType<typeof getEnv>
): Promise<z.infer<typeof FetchMarketListingsInputSchema>> {
  if (env.MARKET_LISTINGS_DISABLE_NOMINATIM) return input;
  const hasRegion =
    (input.bezrealitkyRegionOsmIds?.filter((s) => s.trim()).length ?? 0) > 0 ||
    input.srealityLocalityRegionId != null;
  if (hasRegion) return input;
  const needs = input.sources.some((s) => s === "sreality" || s === "bezrealitky");
  if (!needs) return input;

  const fromHint = input.regionGeocodeHint?.trim();
  const seed = fromHint || input.location.trim();
  if (!shouldTryNominatimSeed(seed, Boolean(fromHint))) return input;

  const ua =
    env.MARKET_FETCH_USER_AGENT?.trim() ||
    "BackOfficeBot/1.0 (+market-listings; respectful Nominatim per OSMF policy)";
  const timeoutMs = Math.min(10_000, env.AGENT_QUERY_TIMEOUT_MS);
  const resolved = await resolveCzMarketRegionFromNominatim({ q: seed, userAgent: ua, timeoutMs });
  if (!resolved) return input;

  logger.info("market_listings_nominatim_region_resolved", { seed, regionLabel: resolved.label });

  return {
    ...input,
    bezrealitkyRegionOsmIds: [...resolved.bezrealitkyRegionOsmIds],
    bezrealitkyRegionLabel: resolved.label,
    srealityLocalityRegionId: resolved.srealityLocalityRegionId
  };
}

export async function fetchMarketListings(input: z.infer<typeof FetchMarketListingsInputSchema>): Promise<MarketListing[]> {
  const env = getEnv();
  const effective = await maybeResolveRegionViaNominatim(input, env);
  const ua = env.MARKET_FETCH_USER_AGENT;
  const merged: MarketListing[] = [];
  const seen = new Set<string>();

  const pushUnique = (rows: MarketListing[]) => {
    for (const r of rows) {
      if (seen.has(r.external_id)) continue;
      seen.add(r.external_id);
      merged.push(r);
    }
  };

  for (const source of effective.sources) {
    if (source === "sreality") {
      const categoryType = effective.srealityOfferKind === "pronajem" ? 2 : 1;
      const rows = await fetchSrealityListings({
        categoryMain: (effective.srealityCategoryMain ?? 1) as 1 | 2,
        categoryType,
        ...(effective.srealityLocalityRegionId != null ? { localityRegionId: effective.srealityLocalityRegionId } : {}),
        localityDistrictId: effective.srealityLocalityDistrictId,
        ...(effective.srealityCategorySubCb != null ? { categorySubCb: effective.srealityCategorySubCb } : {}),
        page: effective.page,
        perPage: effective.perPage,
        userAgent: ua,
        timeoutMs: env.AGENT_QUERY_TIMEOUT_MS
      });
      pushUnique(rows);
      continue;
    }
    if (source === "bezrealitky") {
      const offerType = effective.bezrealitkyOfferType ?? "PRODEJ";
      const variables: Record<string, unknown> = {
        limit: effective.perPage,
        offset: (effective.page - 1) * effective.perPage,
        offerType: [offerType],
        estateType: ["BYT"]
      };
      const ids = effective.bezrealitkyRegionOsmIds?.filter((s) => s.trim());
      if (ids?.length) variables.regionOsmIds = ids;
      const rows = await fetchBezrealitkyListings({
        userAgent: ua,
        timeoutMs: env.AGENT_QUERY_TIMEOUT_MS,
        locationLabel: bezrealitkyLocationLabel(effective),
        autoPaginate: effective.page === 1,
        maxAutoListings: 500,
        variables
      });
      pushUnique(rows);
    }
  }

  return merged;
}

export const UpsertMarketListingsInputSchema = z.object({
  listings: z.array(MarketListingSchema)
});

export const UpsertMarketListingsOutputSchema = z.object({
  upserted: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative()
});

export async function upsertMarketListings(params: { listings: MarketListing[] }): Promise<{ upserted: number; failed: number }> {
  const supabase = getSupabaseAdminClient();
  let upserted = 0;
  let failed = 0;

  for (const listing of params.listings) {
    const { error } = await supabase.from("market_listings").upsert(
      {
        external_id: listing.external_id,
        title: listing.title,
        location: listing.location,
        source: listing.source,
        url: listing.url,
        observed_at: listing.created_at,
        image_url: listing.image_url ?? null
      },
      { onConflict: "external_id" }
    );

    if (error) {
      failed += 1;
      logger.warn("market_listing_upsert_failed", { externalId: listing.external_id, message: error.message });
    } else {
      upserted += 1;
    }
  }

  return { upserted, failed };
}

export const marketListingsToolContract = {
  fetch: {
    name: "fetchMarketListings",
    description: "Ziska nabidky z portalu (Sreality API + volitelne Bezrealitky GraphQL).",
    inputSchema: FetchMarketListingsInputSchema,
    outputSchema: FetchMarketListingsOutputSchema,
    auth: "service-role" as const,
    sideEffects: [] as string[]
  },
  upsert: {
    name: "upsertMarketListings",
    description: "Upsertne market_listings do Supabase podle external_id.",
    inputSchema: UpsertMarketListingsInputSchema,
    outputSchema: UpsertMarketListingsOutputSchema,
    auth: "service-role" as const,
    sideEffects: ["Supabase upsert into market_listings"]
  }
};
