import type { ListingFilters } from "@/lib/listings/filters";
import type { ListingCardDto, ListingDetailDto, ListingMapBounds } from "@/lib/listings/types";
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

type ListingTransitProfileRow = {
  listing_id: string;
  nearest_metro_stop_id: string | null;
  nearest_metro_stop_name: string | null;
  nearest_metro_line: string | null;
  nearest_metro_distance_m: number | null;
  nearest_metro_walk_min: number | null;
  nearest_tram_distance_m: number | null;
  nearest_bus_distance_m: number | null;
  nearest_train_distance_m: number | null;
  transit_score: number | null;
  transit_score_band: "low" | "medium" | "high" | null;
};

export type ListingSearchResult = {
  items: ListingCardDto[];
  total: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
  mapBounds: ListingMapBounds | null;
  totalInBounds: number | null;
};

const listingProjection =
  "id,source_key,source_listing_id,title,description,source_url,locality,city,district,region,country_code,latitude,longitude,offer_type,property_type,disposition,floor_area_m2,land_area_m2,floor_number,total_floors,price_amount,currency,price_note,is_active,first_seen_at,last_seen_at,published_at,metadata,listing_transit_profile(listing_id,nearest_metro_stop_id,nearest_metro_stop_name,nearest_metro_line,nearest_metro_distance_m,nearest_metro_walk_min,nearest_tram_distance_m,nearest_bus_distance_m,nearest_train_distance_m,transit_score,transit_score_band)";

function coerceTransitProfile(value: unknown): ListingTransitProfileRow | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as ListingTransitProfileRow | undefined) ?? null;
  return value as ListingTransitProfileRow;
}

function toListItem(row: ListingRow & { listing_transit_profile?: unknown }, mediaRows: ListingMediaRow[]): ListingCardDto {
  const transit = coerceTransitProfile(row.listing_transit_profile);
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
    galleryPreviewUrls: sorted.slice(0, 10).map((media) => media.media_url),
    imageCount: sorted.length,
    transit: transit
      ? {
          nearestMetroStopId: transit.nearest_metro_stop_id,
          nearestMetroStopName: transit.nearest_metro_stop_name,
          nearestMetroLine: transit.nearest_metro_line,
          nearestMetroDistanceM: transit.nearest_metro_distance_m,
          nearestMetroWalkMin: transit.nearest_metro_walk_min,
          nearestTramDistanceM: transit.nearest_tram_distance_m,
          nearestBusDistanceM: transit.nearest_bus_distance_m,
          nearestTrainDistanceM: transit.nearest_train_distance_m,
          transitScore: transit.transit_score,
          transitScoreBand: transit.transit_score_band
        }
      : undefined
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

function applyFilters(query: any, filters: ListingFilters) {
  let next = query;

  if (!filters.includeInactive) {
    next = next.eq("is_active", true);
  }

  if (filters.sourceKeys?.length) next = next.in("source_key", filters.sourceKeys);
  if (filters.offerTypes?.length) next = next.in("offer_type", filters.offerTypes);
  if (filters.propertyTypes?.length) next = next.in("property_type", filters.propertyTypes);
  if (filters.dispositions?.length) next = next.in("disposition", filters.dispositions);

  if (filters.localityQuery) {
    next = next.or(`locality.ilike.%${filters.localityQuery}%,title.ilike.%${filters.localityQuery}%`);
  }

  if (filters.region) next = next.ilike("region", `%${filters.region}%`);
  if (filters.minPrice != null) next = next.gte("price_amount", filters.minPrice);
  if (filters.maxPrice != null) next = next.lte("price_amount", filters.maxPrice);
  if (filters.minFloorArea != null) next = next.gte("floor_area_m2", filters.minFloorArea);
  if (filters.maxFloorArea != null) next = next.lte("floor_area_m2", filters.maxFloorArea);
  if (filters.minLandArea != null) next = next.gte("land_area_m2", filters.minLandArea);
  if (filters.maxLandArea != null) next = next.lte("land_area_m2", filters.maxLandArea);

  if (filters.bounds) {
    next = next
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .gte("latitude", filters.bounds.south)
      .lte("latitude", filters.bounds.north)
      .gte("longitude", filters.bounds.west)
      .lte("longitude", filters.bounds.east);
  }

  if (filters.nearMetro) {
    next = next.not("listing_transit_profile.nearest_metro_distance_m", "is", null);
  }
  if (filters.maxMetroDistanceM != null) {
    next = next.lte("listing_transit_profile.nearest_metro_distance_m", filters.maxMetroDistanceM);
  }
  if (filters.maxMetroWalkMin != null) {
    next = next.lte("listing_transit_profile.nearest_metro_walk_min", filters.maxMetroWalkMin);
  }
  if (filters.minTransitScore != null) {
    next = next.gte("listing_transit_profile.transit_score", filters.minTransitScore);
  }
  if (filters.metroLines?.length) {
    next = next.in("listing_transit_profile.nearest_metro_line", filters.metroLines);
  }
  if (filters.metroStopIds?.length) {
    next = next.in("listing_transit_profile.nearest_metro_stop_id", filters.metroStopIds);
  }
  if (filters.transitModes?.length) {
    const modeConditions = filters.transitModes.map((mode) => {
      switch (mode) {
        case "metro":
          return "listing_transit_profile.nearest_metro_distance_m.not.is.null";
        case "tram":
          return "listing_transit_profile.nearest_tram_distance_m.not.is.null";
        case "bus":
          return "listing_transit_profile.nearest_bus_distance_m.not.is.null";
        case "train":
          return "listing_transit_profile.nearest_train_distance_m.not.is.null";
        default:
          return null;
      }
    });
    const validConditions = modeConditions.filter(Boolean) as string[];
    if (validConditions.length > 0) {
      if (filters.transitMatchMode === "all") {
        for (const condition of validConditions) {
          const [column] = condition.split(".not.is.null");
          next = next.not(column, "is", null);
        }
      } else {
        next = next.or(validConditions.join(","));
      }
    }
  }

  return next;
}

export async function searchListings(filters: ListingFilters): Promise<ListingSearchResult> {
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("listings")
    .select(listingProjection, { count: "exact" });

  query = applyFilters(query, filters);

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

  const listingRows = (data ?? []) as Array<ListingRow & { listing_transit_profile?: unknown }>;
  const mediaByListingId = await fetchMediaByListingIds(listingRows.map((row) => row.id));

  const items = listingRows.map((row) => toListItem(row, mediaByListingId.get(row.id) ?? []));
  const total = count ?? 0;

  return {
    items,
    total,
    page: filters.page,
    perPage: filters.perPage,
    hasNextPage: filters.page * filters.perPage < total,
    mapBounds: filters.bounds ?? null,
    totalInBounds: filters.bounds ? total : null
  };
}

export async function getListingDetailById(listingId: string): Promise<ListingDetailDto | null> {
  const id = listingId.trim();
  if (!id) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("listings")
    .select(listingProjection)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to read listing detail: ${error.message}`);
  if (!data) return null;

  const row = data as ListingRow;
  const mediaByListingId = await fetchMediaByListingIds([row.id]);
  const mediaRows = mediaByListingId.get(row.id) ?? [];

  const baseMetadata = row.metadata;
  const metadata =
    baseMetadata && typeof baseMetadata === "object"
      ? {
          ...baseMetadata,
          contactName:
            (baseMetadata as Record<string, unknown>).contactName ??
            (baseMetadata as Record<string, unknown>).sellerName ??
            null,
          contactPhone:
            (baseMetadata as Record<string, unknown>).contactPhone ??
            (baseMetadata as Record<string, unknown>).sellerPhone ??
            null,
          contactEmail:
            (baseMetadata as Record<string, unknown>).contactEmail ??
            (baseMetadata as Record<string, unknown>).sellerEmail ??
            null,
          organization:
            (baseMetadata as Record<string, unknown>).organization ??
            (baseMetadata as Record<string, unknown>).sellerOrganization ??
            null
        }
      : null;

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
    metadata
  };
}
