export type ListingMapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type ListingCardDto = {
  id: string;
  sourceKey: string;
  sourceListingId: string;
  title: string;
  description: string | null;
  sourceUrl: string;
  locality: string;
  city: string | null;
  district: string | null;
  region: string | null;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  offerType: string | null;
  propertyType: string | null;
  disposition: string | null;
  floorAreaM2: number | null;
  landAreaM2: number | null;
  floorNumber: number | null;
  totalFloors: number | null;
  priceAmount: number | null;
  currency: string;
  priceNote: string | null;
  isActive: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  publishedAt: string | null;
  previewImageUrl: string | null;
  galleryPreviewUrls: string[];
  imageCount: number;
  isSaved?: boolean;
};

export type ListingDetailDto = ListingCardDto & {
  images: Array<{
    url: string;
    type: string;
    sortOrder: number;
    width: number | null;
    height: number | null;
  }>;
  metadata: Record<string, unknown> | null;
};

export type ListingSearchResponseDto = {
  items: ListingCardDto[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    hasNextPage: boolean;
  };
  map: {
    bounds: ListingMapBounds | null;
    totalInBounds: number | null;
  };
};

export type SavedListingDto = {
  listingId: string;
  savedAt: string;
  listing: ListingCardDto | null;
};
