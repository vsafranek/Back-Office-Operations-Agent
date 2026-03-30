import { z } from "zod";

export const MarketListingSchema = z.object({
  external_id: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  source: z.string().min(1),
  url: z.string().min(1),
  created_at: z.string().min(1),
  /** Náhled fotky (Sreality CDN apod.) */
  image_url: z.string().min(1).optional(),
  /** Částka v Kč z API (pro filtr uložených nálezů); chybí u starších integrací. */
  price_czk: z.number().int().nonnegative().nullable().optional()
});

export type MarketListing = z.infer<typeof MarketListingSchema>;

/**
 * Bez náhledu považujeme inzerát za neověřitelný (často už neexistuje).
 * Jedna pravda pro fetch, API odpověď, nálezy i `market_listings` upsert.
 */
export function marketListingHasPreviewImage(listing: MarketListing): boolean {
  const u = listing.image_url?.trim();
  return Boolean(u && u.length > 0);
}

export function filterMarketListingsWithPreviewImage(listings: MarketListing[]): MarketListing[] {
  return listings.filter(marketListingHasPreviewImage);
}
