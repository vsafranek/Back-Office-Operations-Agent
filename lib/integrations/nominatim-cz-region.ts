import { logger } from "@/lib/observability/logger";
import {
  normCs,
  resolveCzMarketRegionFromKrajState,
  type ResolvedCzMarketRegion
} from "@/lib/integrations/cz-market-regions";
import { matchSrealityDistrictIdForCzPlace } from "@/lib/integrations/sreality-param-catalog";

type NominatimAddress = {
  state?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
};

type NominatimHit = { address?: NominatimAddress };

export type CzMarketLocationResolution =
  | { scope: "region"; region: ResolvedCzMarketRegion }
  | {
      scope: "locality";
      region: ResolvedCzMarketRegion;
      srealityLocalityDistrictId: number;
      /** Zobrazený název místa a filtr u Bezrealitky (výskyt v title/location). */
      listingLocationNeedle: string;
    };

function pickPlaceName(addr: NominatimAddress | undefined): string {
  if (!addr) return "";
  const parts = [addr.city, addr.town, addr.village, addr.municipality];
  for (const p of parts) {
    if (typeof p === "string" && p.trim()) return p.trim();
  }
  return "";
}

function levenshteinWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const cur = dp[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + cost);
      prev = cur;
    }
  }
  return (dp[n] ?? 99) <= max;
}

/** Shoda uživatelského seedu s názvem z Nominatim (vč. pádů „Plzni“ ↔ „Plzeň“). */
export function placeMatchesGeocodeSeed(seedRaw: string, placeNameRaw: string): boolean {
  const a = normCs(seedRaw.trim());
  const b = normCs(placeNameRaw.trim());
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const prefixLen = Math.min(5, a.length, b.length);
  if (prefixLen >= 4 && a.slice(0, prefixLen) === b.slice(0, prefixLen)) return true;
  if (a.length <= 14 && b.length <= 14 && levenshteinWithin(a, b, 2)) return true;
  return false;
}

/**
 * Nominatim (ČR): odvodí buď kraj, nebo užší město s `locality_district_id` + filtrem pro Bezrealitky.
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */
export async function resolveCzMarketLocationFromNominatim(params: {
  q: string;
  userAgent: string;
  timeoutMs: number;
}): Promise<CzMarketLocationResolution | null> {
  const q = params.q.trim();
  if (!q) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "cz");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", q);

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), params.timeoutMs);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      signal: ac.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": params.userAgent
      }
    });
  } catch (e) {
    clearTimeout(t);
    logger.warn("nominatim_cz_fetch_failed", { q, message: e instanceof Error ? e.message : String(e) });
    return null;
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    logger.warn("nominatim_cz_http_error", { q, status: res.status });
    return null;
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    logger.warn("nominatim_cz_json_failed", { q });
    return null;
  }

  if (!Array.isArray(json) || json.length === 0) {
    return null;
  }

  const hit = json[0] as NominatimHit;
  const state = hit.address?.state?.trim();
  const region = resolveCzMarketRegionFromKrajState(state);
  const placeName = pickPlaceName(hit.address);

  if (region && placeName) {
    const districtId = matchSrealityDistrictIdForCzPlace(normCs(placeName));
    if (districtId != null && placeMatchesGeocodeSeed(q, placeName)) {
      logger.info("market_listings_nominatim_locality_resolved", {
        seed: q,
        placeName,
        districtId,
        regionLabel: region.label
      });
      return {
        scope: "locality",
        region,
        srealityLocalityDistrictId: districtId,
        listingLocationNeedle: placeName
      };
    }
  }

  if (region) {
    return { scope: "region", region };
  }

  return null;
}

/**
 * Jen odvod kraje (bez užšího okresu) — zpětná kompatibilita a jednoduché testy.
 */
export async function resolveCzMarketRegionFromNominatim(params: {
  q: string;
  userAgent: string;
  timeoutMs: number;
}): Promise<ResolvedCzMarketRegion | null> {
  const loc = await resolveCzMarketLocationFromNominatim(params);
  return loc?.region ?? null;
}
