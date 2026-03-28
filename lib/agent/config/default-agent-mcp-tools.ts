import type { McpToolRegistryKey } from "@/lib/agent/mcp-tools/config/assemble-registry";

/**
 * Vychozi sada MCP nastroju (vcetne specialistu s role=subagent), ktere mohou agenti volat.
 * listMcpCapabilities se do runtime mapy doplni automaticky.
 */
export const DEFAULT_AGENT_MCP_TOOL_KEYS = [
  "runSqlPreset",
  "generateReportArtifacts",
  "runPresentationAgent",
  "browseCalendarAvailability",
  "suggestViewingSlots",
  "createEmailDraft",
  "listGmailMessages",
  "getGmailMessage",
  "sendGmailOutbound",
  "enqueueWorkflowTask",
  "fetchMarketListings",
  "upsertMarketListings",
  "webSearch",
  "fetchWebPageText"
] as const satisfies ReadonlyArray<McpToolRegistryKey>;
