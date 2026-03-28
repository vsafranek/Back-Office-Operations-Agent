import type { AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { resolveCzMarketRegionFromText } from "@/lib/integrations/cz-market-regions";
import { filterMarketListingsByLocalityHint } from "@/lib/integrations/market-listing-locality-filter";
import { logger } from "@/lib/observability/logger";

export async function runDailyMarketMonitorSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  location: string;
}): Promise<{ upserted: number; failed: number; listingsCount: number }> {
  const region = resolveCzMarketRegionFromText(params.location);
  const fetchInput = {
    location: region?.label ?? params.location,
    ...(region
      ? {
          bezrealitkyRegionOsmIds: [...region.bezrealitkyRegionOsmIds],
          bezrealitkyRegionLabel: region.label,
          srealityLocalityRegionId: region.srealityLocalityRegionId
        }
      : {})
  };
  const listingsRaw = await params.toolRunner.run<{ external_id: string; title: string; location: string; source: string; url: string; created_at: string }[]>(
    "fetchMarketListings",
    params.ctx,
    fetchInput
  );

  const { listings, applied, orNeedles } = filterMarketListingsByLocalityHint(listingsRaw, params.location);
  if (orNeedles?.length && !applied && listingsRaw.length > 0) {
    logger.warn("daily_market_monitor_locality_filter_empty_fallback", {
      location: params.location,
      orNeedles,
      rawCount: listingsRaw.length
    });
  } else if (applied) {
    logger.info("daily_market_monitor_locality_filter_applied", {
      location: params.location,
      orNeedles,
      rawCount: listingsRaw.length,
      kept: listings.length
    });
  }

  const upsert = await params.toolRunner.run<{ upserted: number; failed: number }>("upsertMarketListings", params.ctx, {
    listings
  });

  // Daily monitor returns a compact metrics object; the workflow wrapper will persist workflow_runs status.
  return { upserted: upsert.upserted, failed: upsert.failed, listingsCount: listings.length };
}

