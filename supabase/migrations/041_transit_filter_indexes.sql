CREATE INDEX IF NOT EXISTS listings_active_source_property_idx
  ON public.listings (is_active, source_key, property_type, last_seen_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS listing_transit_profile_metro_distance_score_idx
  ON public.listing_transit_profile (nearest_metro_distance_m, transit_score DESC)
  WHERE nearest_metro_distance_m IS NOT NULL;

CREATE INDEX IF NOT EXISTS listing_transit_profile_walk_score_idx
  ON public.listing_transit_profile (nearest_metro_walk_min, transit_score DESC)
  WHERE nearest_metro_walk_min IS NOT NULL;

CREATE INDEX IF NOT EXISTS listing_transit_profile_mode_presence_idx
  ON public.listing_transit_profile (
    nearest_metro_distance_m,
    nearest_tram_distance_m,
    nearest_bus_distance_m,
    nearest_train_distance_m
  );
