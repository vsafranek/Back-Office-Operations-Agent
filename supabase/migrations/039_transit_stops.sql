CREATE TABLE IF NOT EXISTS public.transit_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_stop_id text NOT NULL UNIQUE,
  name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('metro', 'tram', 'bus', 'train')),
  metro_line text NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transit_stops_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT transit_stops_lat_range CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT transit_stops_lng_range CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT transit_stops_metro_line_required CHECK (
    mode <> 'metro' OR (metro_line IS NOT NULL AND char_length(trim(metro_line)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS transit_stops_mode_active_idx
  ON public.transit_stops (mode, is_active);

CREATE INDEX IF NOT EXISTS transit_stops_metro_line_idx
  ON public.transit_stops (metro_line)
  WHERE mode = 'metro';

CREATE INDEX IF NOT EXISTS transit_stops_active_lat_lng_idx
  ON public.transit_stops (is_active, latitude, longitude)
  WHERE is_active = true;

ALTER TABLE public.transit_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transit_stops_select_public" ON public.transit_stops;
CREATE POLICY "transit_stops_select_public"
  ON public.transit_stops
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
