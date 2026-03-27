import { fetchWebPageText, FetchWebPageTextInputSchema, FetchWebPageTextOutputSchema } from "@/lib/agent/tools/web-fetch-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";
import type { z } from "zod";

const tool: McpTool<z.infer<typeof FetchWebPageTextInputSchema>, z.infer<typeof FetchWebPageTextOutputSchema>> = {
  contract: {
    role: "tool",
    name: "fetchWebPageText",
    description: "Stahne HTML z URL a extrahuje citelný text pro další shrnutí.",
    inputSchema: FetchWebPageTextInputSchema,
    outputSchema: FetchWebPageTextOutputSchema,
    auth: "service-role",
    sideEffects: ["HTTP GET"]
  },
  run: async (_ctx: AgentToolContext, input) => fetchWebPageText(input as z.infer<typeof FetchWebPageTextInputSchema>)
};

export const fetchWebPageTextTool: McpToolConfigEntry = {
  registryKey: "fetchWebPageText",
  tool: tool as McpTool<unknown, unknown>
};
