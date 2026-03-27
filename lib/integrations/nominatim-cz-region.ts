import { logger } from "@/lib/observability/logger";
import {
  resolveCzMarketRegionFromKrajState,
  type ResolvedCzMarketRegion
} from "@/lib/integrations/cz-market-regions";

type NominatimAddress = {
  state?: string;
  city?: string;
  town?: string;
  village?: string;
};

type NominatimHit = { address?: NominatimAddress };

/**
 * Podle názvu místa (obec/město) stáhne první výsledek v ČR a z pole address.state odvodí kraj.
 * Ušetří udržovat dlouhý seznam obcí — stačí mapovat ~14 krajů (viz resolveCzMarketRegionFromKrajState).
 * @see https://operations.osmfoundation.org/policies/nominatim/ — rozumný User-Agent a neagresivní frekvence.
 */
export async function resolveCzMarketRegionFromNominatim(params: {
  q: string;
  userAgent: string;
  timeoutMs: number;
}): Promise<ResolvedCzMarketRegion | null> {
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
  const resolved = resolveCzMarketRegionFromKrajState(state);
  if (resolved) return resolved;

  return null;
}
