import { buildSrealityListingDetailUrl } from "@/lib/integrations/sreality-detail-seo-url";
import { logger } from "@/lib/observability/logger";
import type {
  SourceAdapter,
  SourceAdapterFetchParams,
  SourceAdapterFetchResult,
  SourceListingRecord
} from "@/lib/integrations/sources/source-adapter.types";

const SREALITY_ESTATES = "https://www.sreality.cz/api/cs/v2/estates";
const SREALITY_ORIGIN = "https://www.sreality.cz";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; BackOfficeBot/1.0; +real-estate-portal-ingestion; respectful fetch)";

type SrealityImageLink = { href?: string };

type SrealityEstate = {
  hash_id?: number;
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
  [key: string]: unknown;
};

type SrealityApiPayload = {
  result_size?: number;
  _embedded?: { estates?: SrealityEstate[] };
};

function toAbsoluteSrealityHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/")) return `${SREALITY_ORIGIN}${trimmed}`;
  return null;
}

function isBrowserFriendlySrealityListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("sreality.cz")) return false;
    if (parsed.pathname.includes("/cs/v2/") || parsed.pathname.includes("/api/")) return false;
    if (parsed.searchParams.get("detail")) return true;
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[0] === "detail" && parts.length >= 5;
  } catch {
    return false;
  }
}

function pickAbsoluteDetailUrl(estate: SrealityEstate, hashId: number): string {
  const fromSeo = buildSrealityListingDetailUrl(hashId, estate.seo);
  if (fromSeo) return fromSeo;

  const selfHref = estate._links?.self?.href;
  if (typeof selfHref === "string") {
    const candidate = toAbsoluteSrealityHref(selfHref);
    if (candidate && isBrowserFriendlySrealityListingUrl(candidate)) {
      return candidate;
    }
  }

  return `${SREALITY_ORIGIN}/?detail=${hashId}`;
}

function mapEstateToRecord(estate: SrealityEstate, fetchedAt: string): SourceListingRecord | null {
  const hashId = estate.hash_id;
  if (typeof hashId !== "number" || !Number.isFinite(hashId)) {
    return null;
  }

  return {
    sourceKey: "sreality",
    sourceListingId: String(hashId),
    sourceUrl: pickAbsoluteDetailUrl(estate, hashId),
    fetchedAt,
    rawPayload: estate as Record<string, unknown>
  };
}

export type FetchSrealityAdapterParams = {
  categoryMain?: 1 | 2;
  categoryType?: 1 | 2;
  localityRegionId?: number;
  localityDistrictId?: number;
  categorySubCb?: number;
  userAgent?: string;
  timeoutMs?: number;
  fullScan?: boolean;
  maxPages?: number;
};

export class SrealitySourceAdapter implements SourceAdapter {
  readonly sourceKey = "sreality" as const;

  constructor(private readonly options: FetchSrealityAdapterParams = {}) {}

  private async fetchPage(page: number, perPage: number, signal?: AbortSignal) {
    const query = new URLSearchParams({
      category_main_cb: String(this.options.categoryMain ?? 1),
      category_type_cb: String(this.options.categoryType ?? 1),
      page: String(page),
      per_page: String(perPage)
    });

    if (this.options.localityRegionId != null) {
      query.set("locality_region_id", String(this.options.localityRegionId));
    }
    if (this.options.localityDistrictId != null) {
      query.set("locality_district_id", String(this.options.localityDistrictId));
    }
    if (this.options.categorySubCb != null) {
      query.set("category_sub_cb", String(this.options.categorySubCb));
    }

    const url = `${SREALITY_ESTATES}?${query.toString()}`;
    const timeoutMs = this.options.timeoutMs ?? 20_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": this.options.userAgent?.trim() || DEFAULT_USER_AGENT
        },
        signal: signal ?? controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      logger.warn("sreality_adapter_http_error", { status: response.status, url, page });
      return null;
    }

    try {
      return (await response.json()) as SrealityApiPayload;
    } catch {
      logger.warn("sreality_adapter_json_parse_error", { url, page });
      return null;
    }
  }

  async fetchListings(params: SourceAdapterFetchParams): Promise<SourceAdapterFetchResult> {
    const fetchedAt = new Date().toISOString();
    const page = Math.max(1, params.page ?? 1);
    const perPage = Math.min(Math.max(1, params.perPage ?? 60), 60);

    const firstPayload = await this.fetchPage(page, perPage, params.signal);
    if (!firstPayload) {
      return {
        sourceKey: this.sourceKey,
        fetchedAt,
        records: [],
        diagnostics: {
          fullScanRequested: Boolean(this.options.fullScan),
          pagesRequested: 1,
          pagesSucceeded: 0,
          failedPages: [page],
          cappedByMaxPages: false,
          isCompleteSnapshot: false
        }
      };
    }

    const estates = firstPayload._embedded?.estates;
    if (!Array.isArray(estates)) {
      logger.warn("sreality_adapter_unexpected_shape", { page });
      return {
        sourceKey: this.sourceKey,
        fetchedAt,
        records: [],
        diagnostics: {
          fullScanRequested: Boolean(this.options.fullScan),
          pagesRequested: 1,
          pagesSucceeded: 1,
          failedPages: [],
          cappedByMaxPages: false,
          isCompleteSnapshot: false
        }
      };
    }

    const records: SourceListingRecord[] = estates
      .map((estate) => mapEstateToRecord(estate, fetchedAt))
      .filter((record): record is SourceListingRecord => Boolean(record));

    const totalCount = typeof firstPayload.result_size === "number" ? firstPayload.result_size : undefined;

    if (!this.options.fullScan || !totalCount) {
      return {
        sourceKey: this.sourceKey,
        fetchedAt,
        records,
        totalCount,
        diagnostics: {
          fullScanRequested: Boolean(this.options.fullScan),
          pagesRequested: 1,
          pagesSucceeded: 1,
          failedPages: [],
          totalPagesFromSource: totalCount ? Math.max(1, Math.ceil(totalCount / perPage)) : undefined,
          cappedByMaxPages: false,
          isCompleteSnapshot: true
        }
      };
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
    const maxPagesToFetch = this.options.maxPages ?? totalPages - page + 1;
    const pagesRequested = Math.max(1, Math.min(totalPages - page + 1, maxPagesToFetch));
    const endPage = Math.min(totalPages, page + pagesRequested - 1);
    const cappedByMaxPages = endPage < totalPages;
    const failedPages: number[] = [];
    let pagesSucceeded = 1;

    for (let currentPage = page + 1; currentPage <= endPage; currentPage += 1) {
      const payload = await this.fetchPage(currentPage, perPage, params.signal);
      if (!payload?._embedded?.estates || !Array.isArray(payload._embedded.estates)) {
        failedPages.push(currentPage);
        continue;
      }
      pagesSucceeded += 1;
      for (const estate of payload._embedded.estates) {
        const mapped = mapEstateToRecord(estate, fetchedAt);
        if (mapped) records.push(mapped);
      }
    }

    const isCompleteSnapshot =
      page === 1 &&
      !cappedByMaxPages &&
      failedPages.length === 0 &&
      pagesSucceeded === pagesRequested &&
      records.length >= totalCount;

    return {
      sourceKey: this.sourceKey,
      fetchedAt,
      records,
      totalCount,
      diagnostics: {
        fullScanRequested: true,
        pagesRequested,
        pagesSucceeded,
        failedPages,
        totalPagesFromSource: totalPages,
        cappedByMaxPages,
        isCompleteSnapshot
      }
    };
  }
}
