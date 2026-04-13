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

export type SourceAdapterFetchDiagnostics = {
  fullScanRequested: boolean;
  pagesRequested: number;
  pagesSucceeded: number;
  failedPages: number[];
  totalPagesFromSource?: number;
  cappedByMaxPages: boolean;
  isCompleteSnapshot: boolean;
};

export type SourceAdapterFetchResult = {
  sourceKey: PortalSourceKey;
  fetchedAt: string;
  records: SourceListingRecord[];
  totalCount?: number;
  diagnostics?: SourceAdapterFetchDiagnostics;
};

export interface SourceAdapter {
  readonly sourceKey: PortalSourceKey;
  fetchListings(params: SourceAdapterFetchParams): Promise<SourceAdapterFetchResult>;
}
