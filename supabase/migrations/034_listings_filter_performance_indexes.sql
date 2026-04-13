-- Listing search performance indexes for Zillow-style filtered catalog.

CREATE INDEX IF NOT EXISTS listings_active_last_seen_idx
  ON public.listings (is_active, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS listings_offer_property_idx
  ON public.listings (offer_type, property_type, disposition)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS listings_price_active_idx
  ON public.listings (price_amount)
  WHERE is_active = true AND price_amount IS NOT NULL;

CREATE INDEX IF NOT EXISTS listings_floor_area_active_idx
  ON public.listings (floor_area_m2)
  WHERE is_active = true AND floor_area_m2 IS NOT NULL;
