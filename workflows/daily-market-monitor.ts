import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

type MarketListing = {
  external_id: string;
  title: string;
  location: string;
  source: string;
  url: string;
  created_at: string;
};

async function fetchMockListings(): Promise<MarketListing[]> {
  const now = new Date().toISOString();
  return [
    {
      external_id: `mock-${Date.now()}`,
      title: "Byt 2+kk Praha Holesovice",
      location: "Praha Holesovice",
      source: "mock_feed",
      url: "https://example.com/listing/mock",
      created_at: now
    }
  ];
}

export async function runDailyMarketMonitor() {
  const runRef = `daily-${Date.now()}`;
  const listings = await fetchMockListings();
  const supabase = getSupabaseAdminClient();
  await supabase.from("workflow_runs").insert({
    workflow_name: "daily_market_monitor",
    run_ref: runRef,
    status: "started"
  });

  for (const listing of listings) {
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
      logger.warn("market_listing_upsert_failed", { externalId: listing.external_id, message: error.message });
    }
  }

  logger.info("daily_market_monitor_finished", { inserted: listings.length });
  await supabase
    .from("workflow_runs")
    .update({ status: "completed", finished_at: new Date().toISOString() })
    .eq("run_ref", runRef);

  return { inserted: listings.length };
}
