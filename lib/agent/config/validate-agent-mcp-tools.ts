import type { AgentDefinition } from "@/lib/agent/config/types";
import { ALL_MCP_TOOL_KEYS } from "@/lib/agent/mcp-tools/config/assemble-registry";

const allowed = new Set<string>(ALL_MCP_TOOL_KEYS);

export function assertAgentMcpToolsValid(def: AgentDefinition) {
  for (const key of def.availableMcpTools) {
    if (!allowed.has(key)) {
      throw new Error(`Agent "${def.id}" lists unknown MCP tool key: ${key}`);
    }
  }
}
