import {
  fetchMarketListings,
  FetchMarketListingsInputSchema,
  FetchMarketListingsOutputSchema
} from "@/lib/agent/tools/market-listings-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";
import type { z } from "zod";

const tool: McpTool<z.infer<typeof FetchMarketListingsInputSchema>, z.infer<typeof FetchMarketListingsOutputSchema>> = {
  contract: {
    role: "tool",
    name: "fetchMarketListings",
    description:
      "Ziska nabidky nemovitosti. Parametry: sources, bezrealitkyOfferType, bezrealitkyRegionOsmIds, bezrealitkyRegionLabel, srealityLocalityRegionId, regionGeocodeHint (kratce po \"v …\" pro Nominatim), srealityOfferKind, location. Sreality REST + Bezrealitky GraphQL.",
    inputSchema: FetchMarketListingsInputSchema,
    outputSchema: FetchMarketListingsOutputSchema,
    auth: "service-role",
    sideEffects: []
  },
  run: async (_ctx: AgentToolContext, input) => fetchMarketListings(input)
};

export const fetchMarketListingsTool: McpToolConfigEntry = {
  registryKey: "fetchMarketListings",
  tool: tool as McpTool<unknown, unknown>
};
