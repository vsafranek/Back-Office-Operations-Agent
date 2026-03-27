/**
 * Sreality veřejné REST API (nedokumentované). Používej rozumné limity a v souladu s ToS / robots.
 * @see https://www.sreality.cz/api/cs/v2/estates
 */
import { logger } from "@/lib/observability/logger";
import type { MarketListing } from "@/lib/agent/tools/market-listing-model";

const SREALITY_ESTATES = "https://www.sreality.cz/api/cs/v2/estates";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; BackOfficeBot/1.0; +internal-market-monitor; respectful fetch)";

export type FetchSrealityListingsParams = {
  /** category_main_cb: 1 = byty, 2 = domy */
  categoryMain: 1 | 2;
  /** category_type_cb: 1 = prodej, 2 = pronájem */
  categoryType: 1 | 2;
  /** Např. 10 = Praha. Bez hodnoty = bez filtru regionu (celostátní nabídka). */
  localityRegionId?: number;
  /** Volitelné užší městská část (číslo z webu Sreality) */
  localityDistrictId?: number;
  page: number;
  perPage: number;
  userAgent?: string;
  timeoutMs?: number;
};

type SrealityImageLink = { href?: string };

type SrealityEstate = {
  hash_id?: number;
  name?: string;
  locality?: string;
  price_czk?: { value_raw?: number };
  _links?: {
    self?: { href?: string };
    images?: SrealityImageLink[];
    image_middle2?: SrealityImageLink[];
  };
};

function buildDetailUrl(hashId: number): string {
  return `https://www.sreality.cz/detail/${hashId}`;
}

function mapEstateToListing(estate: SrealityEstate, observedAt: string): MarketListing | null {
  const hash = estate.hash_id;
  if (hash == null || typeof hash !== "number") return null;
  const name = (estate.name ?? "").trim();
  const loc = (estate.locality ?? "").trim();
  if (!name || !loc) return null;
  const priceRaw = estate.price_czk?.value_raw;
  const priceNote =
    typeof priceRaw === "number" && priceRaw > 1 ? ` · ${Math.round(priceRaw).toLocaleString("cs-CZ")} Kč` : "";
  const title = `${name}${priceNote}`;
  const url = buildDetailUrl(hash);

  const imgs = estate._links?.images ?? estate._links?.image_middle2;
  const firstImg = Array.isArray(imgs) ? imgs[0]?.href : undefined;
  const image_url =
    typeof firstImg === "string" && firstImg.startsWith("http") ? firstImg : undefined;

  return {
    external_id: `sreality:${hash}`,
    title,
    location: loc,
    source: "sreality",
    url,
    created_at: observedAt,
    ...(image_url ? { image_url } : {})
  };
}

export async function fetchSrealityListings(params: FetchSrealityListingsParams): Promise<MarketListing[]> {
  const observedAt = new Date().toISOString();
  const ua = params.userAgent?.trim() || DEFAULT_USER_AGENT;
  const timeoutMs = params.timeoutMs ?? 15_000;
  const qs = new URLSearchParams({
    category_main_cb: String(params.categoryMain),
    category_type_cb: String(params.categoryType),
    per_page: String(Math.min(Math.max(params.perPage, 1), 60)),
    page: String(Math.max(params.page, 1))
  });
  if (params.localityRegionId != null) {
    qs.set("locality_region_id", String(params.localityRegionId));
  }
  if (params.localityDistrictId != null) {
    qs.set("locality_district_id", String(params.localityDistrictId));
  }

  const url = `${SREALITY_ESTATES}?${qs.toString()}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      signal: ac.signal,
      headers: { Accept: "application/json", "User-Agent": ua }
    });
  } catch (e) {
    clearTimeout(t);
    logger.warn("sreality_fetch_failed", { message: e instanceof Error ? e.message : String(e) });
    return [];
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    logger.warn("sreality_http_error", { status: res.status, url });
    return [];
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    logger.warn("sreality_json_parse_failed", { url });
    return [];
  }

  const estates = (json as { _embedded?: { estates?: SrealityEstate[] } })?._embedded?.estates;
  if (!Array.isArray(estates)) {
    logger.warn("sreality_unexpected_shape", { url });
    return [];
  }

  const out: MarketListing[] = [];
  for (const e of estates) {
    const row = mapEstateToListing(e, observedAt);
    if (row) out.push(row);
  }
  return out;
}
