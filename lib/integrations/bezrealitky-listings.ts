/**
 * Bezrealitky — GraphQL na api.bezrealitky.cz.
 * Podporované operace v odpovědi: listAdverts, listSimilarAdverts (např. AdvertRelatedList z webu —
 * stejné payload AdvertList { list, totalCount }).
 * Vlastní query + operationName + variables z DevTools: env BEZREALITKY_GRAPHQL_* .
 */
import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";
import type { MarketListing } from "@/lib/agent/tools/market-listing-model";

/** Veřejný GraphQL endpoint z DevTools (POST, Origin www.bezrealitky.cz). */
export const BEZREALITKY_GRAPHQL_DEFAULT_URL = "https://api.bezrealitky.cz/graphql/";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; BackOfficeBot/1.0; +internal-market-monitor; respectful fetch)";

/** Sloučené proměnné pro výchozí query. regionOsmIds doplň volající podle lokace (jinak celá ČR). */
export const BEZREALITKY_DEFAULT_LIST_VARIABLES: Record<string, unknown> = {
  limit: 20,
  offset: 0,
  offerType: ["PRODEJ"],
  estateType: ["BYT"]
};

/** Vytáhni pole inzerátů z AdvertList nebo starších tvarů odpovědi. */
function listFromAdvertListField(value: unknown): Record<string, unknown>[] | null {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Array.isArray((value as { list?: unknown }).list)
  ) {
    return (value as { list: Record<string, unknown>[] }).list;
  }
  if (Array.isArray(value)) {
    return value as Record<string, unknown>[];
  }
  return null;
}

function totalCountFromGraphqlJson(json: unknown): number | undefined {
  const d = (json as { data?: Record<string, unknown> })?.data;
  if (!d) return undefined;
  for (const key of ["listAdverts", "listSimilarAdverts", "list_adverts"]) {
    const block = d[key] as { totalCount?: unknown } | undefined;
    if (block && typeof block.totalCount === "number" && Number.isFinite(block.totalCount)) {
      return block.totalCount;
    }
  }
  return undefined;
}

/** Odpověď z listAdverts / listSimilarAdverts + legacy tvary z vlastního BEZREALITKY_GRAPHQL_QUERY. */
function listingsFromGraphqlData(data: unknown): Record<string, unknown>[] {
  const root = data as Record<string, unknown> | null;
  const d = root?.data as Record<string, unknown> | undefined;
  if (!d) return [];

  const fromSimilar = listFromAdvertListField(d.listSimilarAdverts);
  if (fromSimilar) return fromSimilar;

  const rawListAdverts = d.listAdverts;
  const fromAdverts = listFromAdvertListField(rawListAdverts);
  if (fromAdverts) return fromAdverts;

  const la = d.list_adverts;
  if (Array.isArray(la)) return la as Record<string, unknown>[];

  const edges = (d.advertSearch as { edges?: { node?: unknown }[] } | undefined)?.edges;
  if (Array.isArray(edges)) {
    return edges.map((e) => (e?.node && typeof e.node === "object" ? (e.node as Record<string, unknown>) : {}));
  }

  return [];
}

function pickString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Dotazy jako AdvertRelatedList často nevrací title — složíme z typu nabídky a plochy. */
function syntheticTitleFromTypes(row: Record<string, unknown>): string {
  const parts: string[] = [];
  const offer = pickString(row.offerType);
  const estate = pickString(row.estateType);
  const disp = pickString(row.disposition);
  if (offer) parts.push(offer.replace(/_/g, " "));
  if (estate) parts.push(estate.replace(/_/g, " "));
  if (disp) parts.push(disp.replace(/^DISP_/i, "").replace(/_/g, "+"));
  const surface = row.surface;
  if (typeof surface === "number" && surface > 0) parts.push(`${surface} m²`);
  return parts.join(" · ");
}

function mapAdvertRow(
  row: Record<string, unknown>,
  observedAt: string,
  index: number,
  locationFallback: string
): MarketListing | null {
  const idCandidate = row.id ?? row.uuid ?? row.advertId ?? row.publicId ?? row.hash;
  const id =
    idCandidate != null && String(idCandidate).trim() !== "" ? String(idCandidate).trim() : `idx-${index}`;

  const baseTitle =
    pickString(row.title) ||
    pickString(row.shortTitle) ||
    pickString(row.name) ||
    pickString(row.advertType) ||
    syntheticTitleFromTypes(row) ||
    "Nabídka Bezrealitky";

  const price = row.price;
  const pricePart =
    typeof price === "number" && price > 0 ? ` · ${price.toLocaleString("cs-CZ")} Kč` : "";
  const title = `${baseTitle}${pricePart}`;

  const addrRaw = row.address;
  const surface = row.surface;
  const surfacePart = typeof surface === "number" && surface > 0 ? `${surface} m²` : "";

  let locationFromAddr = "";
  if (typeof addrRaw === "string" && addrRaw.trim()) {
    locationFromAddr = addrRaw.trim();
  } else if (addrRaw && typeof addrRaw === "object" && !Array.isArray(addrRaw)) {
    const addr = addrRaw as Record<string, unknown>;
    const city = pickString(addr.city);
    const street = pickString(addr.street);
    locationFromAddr = [street, city].filter(Boolean).join(", ");
  }

  const location =
    locationFromAddr ||
    [surfacePart, locationFallback].filter(Boolean).join(" · ") ||
    pickString(row.locality) ||
    pickString(row.location) ||
    locationFallback;

  const detailUrl = `https://www.bezrealitky.cz/detail/${id}`;

  const uri = pickString(row.uri) || pickString(row.url) || pickString(row.slug);
  const legacyUrl =
    uri.startsWith("http")
      ? uri
      : uri
        ? `https://www.bezrealitky.cz/nemovitosti-byty-domy/${uri.replace(/^\//, "")}`
        : detailUrl;

  const url = id.startsWith("idx-") ? legacyUrl : detailUrl;

  const main = row.mainImage as { url?: string } | undefined;
  const imageUrl =
    typeof main?.url === "string" && (main.url.startsWith("http") || main.url.startsWith("//"))
      ? main.url.startsWith("//")
        ? `https:${main.url}`
        : main.url
      : undefined;

  return {
    external_id: `bezrealitky:${id}`,
    title,
    location,
    source: "bezrealitky",
    url,
    created_at: observedAt,
    ...(imageUrl ? { image_url: imageUrl } : {})
  };
}

const BEZREALITKY_MAX_BATCH = 60;
const BEZREALITKY_DEFAULT_AUTO_CAP = 500;

export type FetchBezrealitkyListingsParams = {
  /** Přepíše / doplní výchozí proměnné u výchozího query (limit, offset, regionOsmIds, …). */
  variables?: Record<string, unknown>;
  /** Krátký popis lokality v kartě (odpovídá výchozímu region filtru). */
  locationLabel?: string;
  userAgent?: string;
  timeoutMs?: number;
  /**
   * Při `true` a `offset === 0`: opakuje dotaz s rostoucím offsetem, dokud nedorazíme `totalCount`,
   * prázdnou dávku nebo `maxAutoListings` (stejné chování jako nabídka na webu v jednom výpisu).
   */
  autoPaginate?: boolean;
  /** Horní strop počtu inzerátů při autoPaginate (ochrana před velkými souborovými výsledky). */
  maxAutoListings?: number;
};

const DEFAULT_GQL = `
query BezrealitkyListAdverts(
  $limit: Int
  $offset: Int
  $offerType: [OfferType!]
  $estateType: [EstateType!]
  $regionOsmIds: [ID!]
) {
  listAdverts(
    limit: $limit
    offset: $offset
    offerType: $offerType
    estateType: $estateType
    regionOsmIds: $regionOsmIds
  ) {
    totalCount
    list {
      id
      title
      uri
      price
      surface
      mainImage {
        url(filter: RECORD_MAIN)
      }
    }
  }
}
`;

async function postBezrealitkyGraphql(params: {
  endpoint: string;
  queryDoc: string;
  operationName: string | undefined;
  variables: Record<string, unknown>;
  ua: string;
  timeoutMs: number;
  origin: string;
  referer: string;
}): Promise<{ ok: boolean; json?: unknown; status: number }> {
  const payload: Record<string, unknown> = { query: params.queryDoc, variables: params.variables };
  if (params.operationName) {
    payload.operationName = params.operationName;
  }
  const body = JSON.stringify(payload);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), params.timeoutMs);
  let res: Response;
  try {
    res = await fetch(params.endpoint, {
      method: "POST",
      signal: ac.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": params.ua,
        Origin: params.origin,
        Referer: params.referer
      },
      body
    });
  } catch (e) {
    clearTimeout(t);
    logger.warn("bezrealitky_fetch_failed", { message: e instanceof Error ? e.message : String(e) });
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    logger.warn("bezrealitky_http_error", { status: res.status, endpoint: params.endpoint });
    return { ok: false, status: res.status };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    logger.warn("bezrealitky_json_parse_failed", { endpoint: params.endpoint });
    return { ok: false, status: res.status };
  }

  const errs = (json as { errors?: unknown })?.errors;
  if (errs) {
    logger.warn("bezrealitky_graphql_errors", { errors: errs });
    return { ok: false, status: res.status };
  }

  return { ok: true, json, status: res.status };
}

export async function fetchBezrealitkyListings(params?: FetchBezrealitkyListingsParams): Promise<MarketListing[]> {
  const env = getEnv();
  const endpoint = (env.BEZREALITKY_GRAPHQL_URL?.trim() || BEZREALITKY_GRAPHQL_DEFAULT_URL).replace(/\/?$/, "/");

  const observedAt = new Date().toISOString();
  const ua = params?.userAgent?.trim() || DEFAULT_USER_AGENT;
  const timeoutMs = params?.timeoutMs ?? 20_000;
  const locationFallback = params?.locationLabel?.trim() || "Česko";

  const baseVars = { ...BEZREALITKY_DEFAULT_LIST_VARIABLES, ...(params?.variables ?? {}) };
  const requestedOffset = Math.max(0, Number(baseVars.offset) || 0);
  const rawLimit = Number(baseVars.limit);
  const batchLimit = Math.min(
    BEZREALITKY_MAX_BATCH,
    Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20)
  );
  const autoPaginate = Boolean(params?.autoPaginate) && requestedOffset === 0;
  const maxAuto = Math.min(
    Math.max(1, params?.maxAutoListings ?? BEZREALITKY_DEFAULT_AUTO_CAP),
    BEZREALITKY_DEFAULT_AUTO_CAP
  );

  const customQuery = env.BEZREALITKY_GRAPHQL_QUERY?.trim();
  const queryDoc = customQuery || DEFAULT_GQL;
  const operationName = customQuery
    ? env.BEZREALITKY_GRAPHQL_OPERATION_NAME?.trim() || undefined
    : "BezrealitkyListAdverts";

  const origin = env.BEZREALITKY_GRAPHQL_ORIGIN?.trim() || "https://www.bezrealitky.cz";
  const referer = env.BEZREALITKY_GRAPHQL_REFERER?.trim() || "https://www.bezrealitky.cz/";

  const aggregated: Record<string, unknown>[] = [];
  let offset = autoPaginate ? 0 : requestedOffset;
  let totalCount: number | undefined;

  for (;;) {
    const variables = { ...baseVars, limit: batchLimit, offset };
    const result = await postBezrealitkyGraphql({
      endpoint,
      queryDoc,
      operationName,
      variables,
      ua,
      timeoutMs,
      origin,
      referer
    });

    if (!result.ok || result.json === undefined) {
      if (aggregated.length === 0) return [];
      logger.warn("bezrealitky_paginate_request_failed_partial", { collected: aggregated.length });
      break;
    }

    const json = result.json;
    const batch = listingsFromGraphqlData(json);
    const tc = totalCountFromGraphqlJson(json);
    if (typeof tc === "number") totalCount = tc;

    aggregated.push(...batch);

    if (!autoPaginate) break;
    if (batch.length === 0) break;
    if (totalCount !== undefined && aggregated.length >= totalCount) break;
    if (aggregated.length >= maxAuto) {
      if (totalCount !== undefined && aggregated.length < totalCount) {
        logger.warn("bezrealitky_auto_paginate_capped", { totalCount, returned: aggregated.length, maxAuto });
      }
      break;
    }
    if (batch.length < batchLimit) break;

    offset += batchLimit;
  }

  return mapRowsToListings(aggregated, observedAt, locationFallback);
}

function mapRowsToListings(
  rows: Record<string, unknown>[],
  observedAt: string,
  locationFallback: string
): MarketListing[] {
  const out: MarketListing[] = [];
  let i = 0;
  for (const row of rows) {
    const m = mapAdvertRow(row, observedAt, i, locationFallback);
    if (m) out.push(m);
    i += 1;
  }
  return out;
}
