import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { z } from "zod";

export const MarketListingSchema = z.object({
  external_id: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  source: z.string().min(1),
  url: z.string().min(1),
  created_at: z.string().min(1)
});

export type MarketListing = z.infer<typeof MarketListingSchema>;

export const FetchMarketListingsInputSchema = z.object({
  location: z.string().min(1).default("Praha Holešovice")
});

export const FetchMarketListingsOutputSchema = z.array(MarketListingSchema);

export async function fetchMarketListings(input: z.infer<typeof FetchMarketListingsInputSchema>): Promise<MarketListing[]> {
  // For now: mock feed. Later: replace with real portal integrations.
  const now = new Date().toISOString();
  const loc = input.location.trim();
  return [
    {
      external_id: `mock-${Date.now()}`,
      title: "Byt 2+kk Praha Holesovice",
      location: loc,
      source: "mock_feed",
      url: "https://example.com/listing/mock",
      created_at: now
    }
  ];
}

export const UpsertMarketListingsInputSchema = z.object({
  listings: z.array(MarketListingSchema)
});

export const UpsertMarketListingsOutputSchema = z.object({
  upserted: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative()
});

export async function upsertMarketListings(params: { listings: MarketListing[] }): Promise<{ upserted: number; failed: number }> {
  const supabase = getSupabaseAdminClient();
  let upserted = 0;
  let failed = 0;

  for (const listing of params.listings) {
    const { error } = await supabase.from("market_listings").upsert(
      {
        external_id: listing.external_id,
        title: listing.title,
        location: listing.location,
        source: listing.source,
        url: listing.url,
        observed_at: listing.created_at
      },
      { onConflict: "external_id" }
    );

    if (error) {
      failed += 1;
      logger.warn("market_listing_upsert_failed", { externalId: listing.external_id, message: error.message });
    } else {
      upserted += 1;
    }
  }

  return { upserted, failed };
}

export const marketListingsToolContract = {
  fetch: {
    name: "fetchMarketListings",
    description: "Ziska nove nabidky z realitnich portalu (nyni mock).",
    inputSchema: FetchMarketListingsInputSchema,
    outputSchema: FetchMarketListingsOutputSchema,
    auth: "service-role" as const,
    sideEffects: [] as string[]
  },
  upsert: {
    name: "upsertMarketListings",
    description: "Upsertne market_listings do Supabase podle external_id.",
    inputSchema: UpsertMarketListingsInputSchema,
    outputSchema: UpsertMarketListingsOutputSchema,
    auth: "service-role" as const,
    sideEffects: ["Supabase upsert into market_listings"]
  }
};

