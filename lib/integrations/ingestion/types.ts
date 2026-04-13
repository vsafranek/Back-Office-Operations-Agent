import type { PortalSourceKey } from "@/lib/integrations/sources/source-adapter.types";

export type ListingMediaInput = {
  mediaUrl: string;
  mediaType?: string;
  sortOrder?: number;
  width?: number | null;
  height?: number | null;
};

export type CanonicalListingInput = {
  sourceKey: PortalSourceKey;
  sourceListingId: string;
  sourceUrl: string;
  title: string;
  description?: string | null;
  locality: string;
  city?: string | null;
  district?: string | null;
  region?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  offerType?: string | null;
  propertyType?: string | null;
  disposition?: string | null;
  floorAreaM2?: number | null;
  landAreaM2?: number | null;
  floorNumber?: number | null;
  totalFloors?: number | null;
  priceAmount?: number | null;
  currency?: string | null;
  priceNote?: string | null;
  isActive?: boolean;
  publishedAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type ParsedListingInput = {
  listing: CanonicalListingInput;
  media: ListingMediaInput[];
  parserName: string;
  parserVersion: string;
  confidence?: number | null;
  fallbackUsed?: boolean;
  parsedData?: Record<string, unknown>;
  diagnostics?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
  enrichmentSource?: string | null;
};

export type UpsertParsedListingInput = ParsedListingInput & {
  rawPayload: Record<string, unknown>;
  fetchedAt: string;
};

export type ListingIngestionSummary = {
  fetchedCount: number;
  parsedCount: number;
  upsertedCount: number;
  failedCount: number;
};
