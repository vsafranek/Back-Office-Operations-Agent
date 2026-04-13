import type { ListingFilters } from "@/lib/listings/filters";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

type ListingRow = {
  id: string;
  source_key: string;
  source_listing_id: string;
  title: string;
  description: string | null;
  source_url: string;
  locality: string;
  city: string | null;
  district: string | null;
  region: string | null;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
  offer_type: string | null;
  property_type: string | null;
  disposition: string | null;
  floor_area_m2: number | null;
  land_area_m2: number | null;
  floor_number: number | null;
  total_floors: number | null;
  price_amount: number | null;
  currency: string;
  price_note: string | null;
  is_active: boolean;
  first_seen_at: string;
  last_seen_at: string;
  published_at: string | null;
  metadata: Record<string, unknown> | null;
};

type ListingMediaRow = {
  listing_id: string;
  media_url: string;
  media_type: string;
  sort_order: number;
  width?: number | null;
  height?: number | null;
};

export type ListingListItem = {
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
  imageCount: number;
};

export type ListingDetailItem = ListingListItem & {
  images: Array<{
    url: string;
    type: string;
    sortOrder: number;
    width: number | null;
    height: number | null;
  }>;
  metadata: Record<string, unknown> | null;
};

export type ListingSearchResult = {
  items: ListingListItem[];
  total: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
};

function toListItem(row: ListingRow, mediaRows: ListingMediaRow[]): ListingListItem {
  const sorted = [...mediaRows].sort((a, b) => a.sort_order - b.sort_order);
  return {
    id: row.id,
    sourceKey: row.source_key,
    sourceListingId: row.source_listing_id,
    title: row.title,
    description: row.description,
    sourceUrl: row.source_url,
    locality: row.locality,
    city: row.city,
    district: row.district,
    region: row.region,
    countryCode: row.country_code,
    latitude: row.latitude,
    longitude: row.longitude,
    offerType: row.offer_type,
    propertyType: row.property_type,
    disposition: row.disposition,
    floorAreaM2: row.floor_area_m2,
    landAreaM2: row.land_area_m2,
    floorNumber: row.floor_number,
    totalFloors: row.total_floors,
    priceAmount: row.price_amount,
    currency: row.currency,
    priceNote: row.price_note,
    isActive: row.is_active,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    publishedAt: row.published_at,
    previewImageUrl: sorted[0]?.media_url ?? null,
    imageCount: sorted.length
  };
}

async function fetchMediaByListingIds(listingIds: string[]): Promise<Map<string, ListingMediaRow[]>> {
  const supabase = getSupabaseAdminClient();
  if (listingIds.length === 0) return new Map<string, ListingMediaRow[]>();

  const { data: mediaRows, error: mediaError } = await supabase
    .from("listing_media")
    .select("listing_id,media_url,media_type,sort_order,width,height")
    .in("listing_id", listingIds)
    .order("sort_order", { ascending: true });

  if (mediaError) {
    throw new Error(`Failed to read listing media: ${mediaError.message}`);
  }

  return (mediaRows ?? []).reduce((acc, row) => {
    const casted = row as ListingMediaRow;
    const current = acc.get(casted.listing_id) ?? [];
    current.push(casted);
    acc.set(casted.listing_id, current);
    return acc;
  }, new Map<string, ListingMediaRow[]>());
}

export async function searchListings(filters: ListingFilters): Promise<ListingSearchResult> {
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("listings")
    .select(
      "id,source_key,source_listing_id,title,description,source_url,locality,city,district,region,country_code,latitude,longitude,offer_type,property_type,disposition,floor_area_m2,land_area_m2,floor_number,total_floors,price_amount,currency,price_note,is_active,first_seen_at,last_seen_at,published_at,metadata",
      { count: "exact" }
    );

  if (!filters.includeInactive) {
    query = query.eq("is_active", true);
  }

  if (filters.sourceKeys?.length) query = query.in("source_key", filters.sourceKeys);
  if (filters.offerTypes?.length) query = query.in("offer_type", filters.offerTypes);
  if (filters.propertyTypes?.length) query = query.in("property_type", filters.propertyTypes);
  if (filters.dispositions?.length) query = query.in("disposition", filters.dispositions);

  if (filters.localityQuery) {
    query = query.or(`locality.ilike.%${filters.localityQuery}%,title.ilike.%${filters.localityQuery}%`);
  }

  if (filters.region) query = query.ilike("region", `%${filters.region}%`);
  if (filters.minPrice != null) query = query.gte("price_amount", filters.minPrice);
  if (filters.maxPrice != null) query = query.lte("price_amount", filters.maxPrice);
  if (filters.minFloorArea != null) query = query.gte("floor_area_m2", filters.minFloorArea);
  if (filters.maxFloorArea != null) query = query.lte("floor_area_m2", filters.maxFloorArea);
  if (filters.minLandArea != null) query = query.gte("land_area_m2", filters.minLandArea);
  if (filters.maxLandArea != null) query = query.lte("land_area_m2", filters.maxLandArea);

  switch (filters.sort) {
    case "price_asc":
      query = query.order("price_amount", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("price_amount", { ascending: false, nullsFirst: false });
      break;
    case "area_asc":
      query = query.order("floor_area_m2", { ascending: true, nullsFirst: false });
      break;
    case "area_desc":
      query = query.order("floor_area_m2", { ascending: false, nullsFirst: false });
      break;
    case "last_seen_desc":
    default:
      query = query.order("last_seen_at", { ascending: false });
      break;
  }

  const from = (filters.page - 1) * filters.perPage;
  const to = from + filters.perPage - 1;

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(`Failed to read listings: ${error.message}`);

  const listingRows = (data ?? []) as ListingRow[];
  const mediaByListingId = await fetchMediaByListingIds(listingRows.map((row) => row.id));

  const items = listingRows.map((row) => toListItem(row, mediaByListingId.get(row.id) ?? []));
  const total = count ?? 0;

  return {
    items,
    total,
    page: filters.page,
    perPage: filters.perPage,
    hasNextPage: filters.page * filters.perPage < total
  };
}

export async function getListingDetailById(listingId: string): Promise<ListingDetailItem | null> {
  const id = listingId.trim();
  if (!id) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id,source_key,source_listing_id,title,description,source_url,locality,city,district,region,country_code,latitude,longitude,offer_type,property_type,disposition,floor_area_m2,land_area_m2,floor_number,total_floors,price_amount,currency,price_note,is_active,first_seen_at,last_seen_at,published_at,metadata"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to read listing detail: ${error.message}`);
  if (!data) return null;

  const row = data as ListingRow;
  const mediaByListingId = await fetchMediaByListingIds([row.id]);
  const mediaRows = mediaByListingId.get(row.id) ?? [];

  return {
    ...toListItem(row, mediaRows),
    images: mediaRows
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((media) => ({
        url: media.media_url,
        type: media.media_type,
        sortOrder: media.sort_order,
        width: media.width ?? null,
        height: media.height ?? null
      })),
    metadata: row.metadata
  };
}
