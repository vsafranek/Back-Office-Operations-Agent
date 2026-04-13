import type { ListingCardDto, SavedListingDto } from "@/lib/listings/types";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

type ListingJoinedRow = {
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
};

type SavedListingRow = {
  listing_id: string;
  created_at: string;
  listings: ListingJoinedRow[] | null;
};

function toListingDto(row: ListingJoinedRow | null | undefined): ListingCardDto | null {
  if (!row) return null;

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
    previewImageUrl: null,
    galleryPreviewUrls: [],
    imageCount: 0,
    isSaved: true
  };
}

export async function listSavedListings(userId: string): Promise<SavedListingDto[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("saved_listings")
    .select(
      "listing_id,created_at,listings(id,source_key,source_listing_id,title,description,source_url,locality,city,district,region,country_code,latitude,longitude,offer_type,property_type,disposition,floor_area_m2,land_area_m2,floor_number,total_floors,price_amount,currency,price_note,is_active,first_seen_at,last_seen_at,published_at)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load saved listings: ${error.message}`);
  }

  return ((data ?? []) as unknown as SavedListingRow[]).map((row) => ({
    listingId: row.listing_id,
    savedAt: row.created_at,
    listing: toListingDto(row.listings?.[0])
  }));
}

export async function saveListingForUser(userId: string, listingId: string): Promise<SavedListingDto> {
  const supabase = getSupabaseAdminClient();

  const { data: listingExists, error: listingError } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError) {
    throw new Error(`Unable to verify listing: ${listingError.message}`);
  }
  if (!listingExists) {
    throw new Error("Listing not found.");
  }

  const { data: inserted, error } = await supabase
    .from("saved_listings")
    .upsert(
      {
        user_id: userId,
        listing_id: listingId
      },
      { onConflict: "user_id,listing_id" }
    )
    .select("listing_id,created_at")
    .single();

  if (error || !inserted) {
    throw new Error(`Unable to save listing: ${error?.message ?? "unknown error"}`);
  }

  const items = await listSavedListings(userId);
  const found = items.find((item) => item.listingId === listingId);

  return (
    found ?? {
      listingId,
      savedAt: inserted.created_at as string,
      listing: null
    }
  );
}

export async function unsaveListingForUser(userId: string, listingId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { error, count } = await supabase
    .from("saved_listings")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("listing_id", listingId);

  if (error) {
    throw new Error(`Unable to remove saved listing: ${error.message}`);
  }

  return (count ?? 0) > 0;
}
