/**
 * Sreality veřejné REST API (nedokumentované). Používej rozumné limity a v souladu s ToS / robots.
 * @see https://www.sreality.cz/api/cs/v2/estates
 */
import { logger } from "@/lib/observability/logger";
import type { MarketListing } from "@/lib/agent/tools/market-listing-model";
import { buildSrealityListingDetailUrl } from "@/lib/integrations/sreality-detail-seo-url";

const SREALITY_ESTATES = "https://www.sreality.cz/api/cs/v2/estates";
const SREALITY_ORIGIN = "https://www.sreality.cz";

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
  /**
   * Dispozice (byty) nebo typ domu — `category_sub_cb` v API.
   * @see lib/integrations/sreality-param-catalog.ts
   */
  categorySubCb?: number;
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
  seo?: {
    category_main_cb?: number;
    category_sub_cb?: number;
    category_type_cb?: number;
    locality?: string;
  };
  _links?: {
    self?: { href?: string };
    images?: SrealityImageLink[];
    image_middle2?: SrealityImageLink[];
  };
};

/**
 * Veřejná stránka detailu: preferuje SEO `/detail/{typ}/{kategorie}/{podtyp}/{lokalita}/{id}` z `seo`,
 * jinak bezpečný `self` odkaz z API, jinak `?detail=` (může vyžadovat JS na webu Sreality).
 */
export function pickAbsoluteDetailUrl(estate: SrealityEstate, hash: number): string {
  const fromSeo = buildSrealityListingDetailUrl(hash, estate.seo);
  if (fromSeo) return fromSeo;

  const selfHref = estate._links?.self?.href;
  if (typeof selfHref === "string") {
    const candidate = toAbsoluteSrealityHref(selfHref);
    if (candidate && isBrowserFriendlySrealityListingUrl(candidate)) {
      return candidate;
    }
  }
  return buildDetailUrl(hash);
}

function toAbsoluteSrealityHref(href: string): string | null {
  const t = href.trim();
  if (!t) return null;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/")) return `${SREALITY_ORIGIN}${t}`;
  return null;
}

/**
 * Odfiltruje API odkazy (`/cs/v2/estates/…`) a přijme jen užitečné uživatelské URL
 * (SEO `/detail/…/…/…/…/id` nebo `/?detail=`).
 */
function isBrowserFriendlySrealityListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("sreality.cz")) return false;
    if (u.pathname.includes("/cs/v2/") || u.pathname.includes("/api/")) return false;
    if (u.searchParams.get("detail")) return true;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "detail" && parts.length >= 5) return true;
    return false;
  } catch {
    return false;
  }
}

function buildDetailUrl(hashId: number): string {
  return `${SREALITY_ORIGIN}/?detail=${hashId}`;
}

function mapEstateToListing(estate: SrealityEstate, observedAt: string): MarketListing | null {
  const hash = estate.hash_id;
  if (hash == null || typeof hash !== "number") return null;
  const name = (estate.name ?? "").trim();
  const loc = (estate.locality ?? "").trim();
  if (!name || !loc) return null;
  const priceRaw = estate.price_czk?.value_raw;
  const priceCzk = typeof priceRaw === "number" && priceRaw > 1 ? Math.round(priceRaw) : null;
  const priceNote =
    priceCzk != null ? ` · ${priceCzk.toLocaleString("cs-CZ")} Kč` : "";
  const title = `${name}${priceNote}`;
  const url = pickAbsoluteDetailUrl(estate, hash);

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
    ...(priceCzk != null ? { price_czk: priceCzk } : {}),
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
  if (params.categorySubCb != null) {
    qs.set("category_sub_cb", String(params.categorySubCb));
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
