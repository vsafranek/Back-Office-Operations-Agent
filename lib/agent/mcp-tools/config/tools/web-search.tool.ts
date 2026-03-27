import { webSearch, WebSearchInputSchema, WebSearchOutputSchema } from "@/lib/agent/tools/web-search-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";
import type { z } from "zod";

const tool: McpTool<z.infer<typeof WebSearchInputSchema>, z.infer<typeof WebSearchOutputSchema>> = {
  contract: {
    role: "tool",
    name: "webSearch",
    description: "Vyhleda informace na webu. Implementace pouziva DuckDuckGo HTML (bez API klíče).",
    inputSchema: WebSearchInputSchema,
    outputSchema: WebSearchOutputSchema,
    auth: "service-role",
    sideEffects: ["HTTP GET na DuckDuckGo"]
  },
  run: async (_ctx: AgentToolContext, input) => webSearch(input)
};

export const webSearchTool: McpToolConfigEntry = {
  registryKey: "webSearch",
  tool: tool as McpTool<unknown, unknown>
};
