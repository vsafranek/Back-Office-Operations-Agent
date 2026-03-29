import { logger } from "@/lib/observability/logger";

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  hamlet?: string;
  state?: string;
  county?: string;
};

export type NominatimPlaceSuggestion = {
  /** Krátký text do vyladění „Lokalita“ (obec / město). */
  value: string;
  /** Delší řádek v rozbalovací nabídce (Nominatim display_name). */
  label: string;
};

type NominatimRow = {
  display_name?: string;
  address?: NominatimAddress;
};

function shortPlaceName(row: NominatimRow): string {
  const a = row.address;
  const fromAddr =
    a?.city?.trim() ||
    a?.town?.trim() ||
    a?.village?.trim() ||
    a?.municipality?.trim() ||
    a?.hamlet?.trim();
  if (fromAddr) return fromAddr;
  const dn = row.display_name?.trim();
  if (dn) return dn.split(",")[0]!.trim();
  return "";
}

/** Navrhy míst v ČR přes veřejný Nominatim (server-side; rozumný User-Agent a limit). */
export async function fetchNominatimCzPlaceSuggestions(params: {
  q: string;
  userAgent: string;
  timeoutMs: number;
  limit?: number;
}): Promise<NominatimPlaceSuggestion[]> {
  const q = params.q.trim();
  if (q.length < 2) return [];
  const limit = Math.min(10, Math.max(1, params.limit ?? 8));

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "cz");
  url.searchParams.set("limit", String(limit));
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
    logger.warn("nominatim_suggest_fetch_failed", { q, message: e instanceof Error ? e.message : String(e) });
    return [];
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    logger.warn("nominatim_suggest_http_error", { q, status: res.status });
    return [];
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    logger.warn("nominatim_suggest_json_failed", { q });
    return [];
  }

  if (!Array.isArray(json)) return [];

  const usedShort = new Set<string>();
  const out: NominatimPlaceSuggestion[] = [];

  for (const raw of json as NominatimRow[]) {
    const label = raw.display_name?.trim();
    if (!label) continue;

    const base = shortPlaceName(raw) || label.split(",")[0]!.trim();
    if (!base) continue;

    const state = raw.address?.state?.trim();
    const county = raw.address?.county?.trim();
    let value = base;
    if (usedShort.has(value.toLowerCase())) {
      const hint = [state, county].filter(Boolean).join(" · ");
      value = hint ? `${base} (${hint})` : `${base} (${out.length + 1})`;
    }
    let safety = 0;
    while (usedShort.has(value.toLowerCase()) && safety < 12) {
      safety += 1;
      value = `${base} (${safety})`;
    }
    usedShort.add(value.toLowerCase());

    out.push({ value, label });
    if (out.length >= limit) break;
  }

  return out;
}
