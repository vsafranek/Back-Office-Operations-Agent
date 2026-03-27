import type { McpTool } from "@/lib/agent/mcp-tools/types";
import { createListMcpCapabilitiesTool } from "@/lib/agent/mcp-tools/list-capabilities-tool";
import { runSqlPresetTool } from "@/lib/agent/mcp-tools/config/tools/run-sql-preset.tool";
import { generateReportArtifactsTool } from "@/lib/agent/mcp-tools/config/tools/generate-report-artifacts.tool";
import { runPresentationAgentTool } from "@/lib/agent/mcp-tools/config/tools/run-presentation-agent.tool";
import { suggestViewingSlotsTool } from "@/lib/agent/mcp-tools/config/tools/suggest-viewing-slots.tool";
import { createEmailDraftTool } from "@/lib/agent/mcp-tools/config/tools/create-email-draft.tool";
import { enqueueWorkflowTaskTool } from "@/lib/agent/mcp-tools/config/tools/enqueue-workflow-task.tool";
import { fetchMarketListingsTool } from "@/lib/agent/mcp-tools/config/tools/fetch-market-listings.tool";
import { upsertMarketListingsTool } from "@/lib/agent/mcp-tools/config/tools/upsert-market-listings.tool";
import { webSearchTool } from "@/lib/agent/mcp-tools/config/tools/web-search.tool";
import { fetchWebPageTextTool } from "@/lib/agent/mcp-tools/config/tools/fetch-web-page-text.tool";

/** Pevny seznam MCP polozek (bez listMcpCapabilities — ten se dosadi). */
export const MCP_TOOL_CONFIG_ENTRIES = [
  runSqlPresetTool,
  generateReportArtifactsTool,
  runPresentationAgentTool,
  suggestViewingSlotsTool,
  createEmailDraftTool,
  enqueueWorkflowTaskTool,
  fetchMarketListingsTool,
  upsertMarketListingsTool,
  webSearchTool,
  fetchWebPageTextTool
] as const;

export type McpToolRegistryKey = (typeof MCP_TOOL_CONFIG_ENTRIES)[number]["registryKey"];

export const ALL_MCP_TOOL_KEYS: readonly McpToolRegistryKey[] = MCP_TOOL_CONFIG_ENTRIES.map((e) => e.registryKey);

let cachedFullMap: Record<string, McpTool<unknown, unknown>> | null = null;

/** Kompletni registry (pro testy, admin). */
export function buildFullMcpToolMap(): Record<string, McpTool<unknown, unknown>> {
  if (cachedFullMap) {
    return cachedFullMap;
  }
  const tools: Record<string, McpTool<unknown, unknown>> = {};
  for (const entry of MCP_TOOL_CONFIG_ENTRIES) {
    if (tools[entry.registryKey]) {
      throw new Error(`Duplicate MCP registry key: ${entry.registryKey}`);
    }
    tools[entry.registryKey] = entry.tool as McpTool<unknown, unknown>;
  }
  tools.listMcpCapabilities = createListMcpCapabilitiesTool(() => tools) as McpTool<unknown, unknown>;
  cachedFullMap = tools;
  return tools;
}

/** Omezene rozhrani podle agenta + vzdy listMcpCapabilities nad timto podmnozinstvim. */
export function buildRestrictedMcpToolMap(
  allowedKeys: readonly McpToolRegistryKey[]
): Record<string, McpTool<unknown, unknown>> {
  const full = buildFullMcpToolMap();
  const picked: Record<string, McpTool<unknown, unknown>> = {};
  for (const key of allowedKeys) {
    const t = full[key];
    if (!t) {
      throw new Error(`Unknown MCP tool key in agent config: ${key}`);
    }
    picked[key] = t;
  }
  picked.listMcpCapabilities = createListMcpCapabilitiesTool(() => picked) as McpTool<unknown, unknown>;
  return picked;
}
