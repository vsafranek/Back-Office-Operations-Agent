import { z } from "zod";

export const MarketListingSchema = z.object({
  external_id: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  source: z.string().min(1),
  url: z.string().min(1),
  created_at: z.string().min(1),
  /** Náhled fotky (Sreality CDN apod.) */
  image_url: z.string().min(1).optional()
});

export type MarketListing = z.infer<typeof MarketListingSchema>;
