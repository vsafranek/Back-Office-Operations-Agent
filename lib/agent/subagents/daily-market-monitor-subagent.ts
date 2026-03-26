import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";

export async function runDailyMarketMonitorSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  location: string;
}): Promise<{ upserted: number; failed: number; listingsCount: number }> {
  const listings = await params.toolRunner.run<{ external_id: string; title: string; location: string; source: string; url: string; created_at: string }[]>(
    "fetchMarketListings",
    params.ctx,
    { location: params.location }
  );

  const upsert = await params.toolRunner.run<{ upserted: number; failed: number }>("upsertMarketListings", params.ctx, {
    listings
  });

  // Daily monitor returns a compact metrics object; the workflow wrapper will persist workflow_runs status.
  return { upserted: upsert.upserted, failed: upsert.failed, listingsCount: listings.length };
}

