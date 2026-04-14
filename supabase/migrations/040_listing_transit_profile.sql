CREATE TABLE IF NOT EXISTS public.listing_transit_profile (
  listing_id uuid PRIMARY KEY REFERENCES public.listings (id) ON DELETE CASCADE,
  nearest_metro_stop_id uuid NULL REFERENCES public.transit_stops (id) ON DELETE SET NULL,
  nearest_metro_stop_name text NULL,
  nearest_metro_line text NULL,
  nearest_metro_distance_m integer NULL CHECK (nearest_metro_distance_m >= 0),
  nearest_metro_walk_min integer NULL CHECK (nearest_metro_walk_min >= 0),
  nearest_tram_distance_m integer NULL CHECK (nearest_tram_distance_m >= 0),
  nearest_bus_distance_m integer NULL CHECK (nearest_bus_distance_m >= 0),
  nearest_train_distance_m integer NULL CHECK (nearest_train_distance_m >= 0),
  transit_score integer NULL CHECK (transit_score >= 0 AND transit_score <= 100),
  transit_score_band text NULL CHECK (transit_score_band IN ('low', 'medium', 'high')),
  computed_at timestamptz NOT NULL DEFAULT now(),
  computation_version text NOT NULL DEFAULT 'v1',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_transit_profile_nearest_metro_distance_idx
  ON public.listing_transit_profile (nearest_metro_distance_m)
  WHERE nearest_metro_distance_m IS NOT NULL;

CREATE INDEX IF NOT EXISTS listing_transit_profile_nearest_metro_walk_idx
  ON public.listing_transit_profile (nearest_metro_walk_min)
  WHERE nearest_metro_walk_min IS NOT NULL;

CREATE INDEX IF NOT EXISTS listing_transit_profile_score_idx
  ON public.listing_transit_profile (transit_score DESC)
  WHERE transit_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS listing_transit_profile_nearest_metro_line_idx
  ON public.listing_transit_profile (nearest_metro_line)
  WHERE nearest_metro_line IS NOT NULL;

CREATE INDEX IF NOT EXISTS listing_transit_profile_nearest_metro_stop_idx
  ON public.listing_transit_profile (nearest_metro_stop_id)
  WHERE nearest_metro_stop_id IS NOT NULL;

ALTER TABLE public.listing_transit_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_transit_profile_select_public" ON public.listing_transit_profile;
CREATE POLICY "listing_transit_profile_select_public"
  ON public.listing_transit_profile
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id = listing_transit_profile.listing_id
        AND l.is_active = true
    )
  );
