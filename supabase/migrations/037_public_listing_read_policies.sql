DROP POLICY IF EXISTS "listings_select_authenticated" ON public.listings;
DROP POLICY IF EXISTS "listings_select_public" ON public.listings;

CREATE POLICY "listings_select_public"
  ON public.listings
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "listing_media_select_authenticated" ON public.listing_media;
DROP POLICY IF EXISTS "listing_media_select_public" ON public.listing_media;

CREATE POLICY "listing_media_select_public"
  ON public.listing_media
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id = listing_media.listing_id
        AND l.is_active = true
    )
  );
