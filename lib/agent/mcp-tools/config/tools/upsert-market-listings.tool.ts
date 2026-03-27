import {
  upsertMarketListings,
  UpsertMarketListingsInputSchema,
  UpsertMarketListingsOutputSchema
} from "@/lib/agent/tools/market-listings-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";
import type { z } from "zod";

const tool: McpTool<z.infer<typeof UpsertMarketListingsInputSchema>, z.infer<typeof UpsertMarketListingsOutputSchema>> = {
  contract: {
    role: "tool",
    name: "upsertMarketListings",
    description: "Upsertne market_listings do Supabase podle external_id.",
    inputSchema: UpsertMarketListingsInputSchema,
    outputSchema: UpsertMarketListingsOutputSchema,
    auth: "service-role",
    sideEffects: ["Supabase upsert into market_listings"]
  },
  run: async (_ctx: AgentToolContext, input) => upsertMarketListings(input)
};

export const upsertMarketListingsTool: McpToolConfigEntry = {
  registryKey: "upsertMarketListings",
  tool: tool as McpTool<unknown, unknown>
};
