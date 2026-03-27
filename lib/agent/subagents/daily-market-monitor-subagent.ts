import type { AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { resolveCzMarketRegionFromText } from "@/lib/integrations/cz-market-regions";

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
  const listings = await params.toolRunner.run<{ external_id: string; title: string; location: string; source: string; url: string; created_at: string }[]>(
    "fetchMarketListings",
    params.ctx,
    fetchInput
  );

  const upsert = await params.toolRunner.run<{ upserted: number; failed: number }>("upsertMarketListings", params.ctx, {
    listings
  });

  // Daily monitor returns a compact metrics object; the workflow wrapper will persist workflow_runs status.
  return { upserted: upsert.upserted, failed: upsert.failed, listingsCount: listings.length };
}

