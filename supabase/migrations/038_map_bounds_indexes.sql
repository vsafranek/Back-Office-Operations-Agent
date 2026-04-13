CREATE INDEX IF NOT EXISTS listings_active_lat_lng_idx
  ON public.listings (is_active, latitude, longitude)
  WHERE is_active = true AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS listings_active_offer_property_price_idx
  ON public.listings (is_active, offer_type, property_type, price_amount)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS listings_active_disposition_area_idx
  ON public.listings (is_active, disposition, floor_area_m2)
  WHERE is_active = true;
