import type { McpTool } from "@/lib/agent/mcp-tools/types";

/** Jeden MCP nastroj = klic v ToolRunner mape + implementace. */
export type McpToolConfigEntry = {
  readonly registryKey: string;
  readonly tool: McpTool<unknown, unknown>;
};
