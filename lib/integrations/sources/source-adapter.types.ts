export type PortalSourceKey = "sreality" | (string & {});

export type SourceListingRecord = {
  sourceKey: PortalSourceKey;
  sourceListingId: string;
  sourceUrl: string;
  fetchedAt: string;
  rawPayload: Record<string, unknown>;
};

export type SourceAdapterFetchParams = {
  page?: number;
  perPage?: number;
  signal?: AbortSignal;
};

export type SourceAdapterFetchResult = {
  sourceKey: PortalSourceKey;
  fetchedAt: string;
  records: SourceListingRecord[];
  totalCount?: number;
};

export interface SourceAdapter {
  readonly sourceKey: PortalSourceKey;
  fetchListings(params: SourceAdapterFetchParams): Promise<SourceAdapterFetchResult>;
}
