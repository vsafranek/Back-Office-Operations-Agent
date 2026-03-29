import type { AgentDefinition } from "../types";
import { DEFAULT_AGENT_MCP_TOOL_KEYS } from "../default-agent-mcp-tools";

export const basicAgentConfig: AgentDefinition = {
  id: "basic",
  label: "Základní Agent",
  description:
    "Rychlá klasifikace záměru jedním krokem, pak specializovaný subagent. Na běžné pozdravy a small talk odpovídá stručně bez zbytečného web vyhledávání.",
  mode: "basic",
  availableMcpTools: DEFAULT_AGENT_MCP_TOOL_KEYS
};
