CREATE TABLE IF NOT EXISTS public.saved_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_listings_user_listing_unique UNIQUE (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS saved_listings_user_created_idx
  ON public.saved_listings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS saved_listings_listing_idx
  ON public.saved_listings (listing_id);

ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_listings_select_owner" ON public.saved_listings;
CREATE POLICY "saved_listings_select_owner"
  ON public.saved_listings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_listings_insert_owner" ON public.saved_listings;
CREATE POLICY "saved_listings_insert_owner"
  ON public.saved_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_listings_delete_owner" ON public.saved_listings;
CREATE POLICY "saved_listings_delete_owner"
  ON public.saved_listings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
