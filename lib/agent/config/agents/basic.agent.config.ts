import type { AgentDefinition } from "../types";
import { DEFAULT_AGENT_MCP_TOOL_KEYS } from "../default-agent-mcp-tools";

export const basicAgentConfig: AgentDefinition = {
  id: "basic",
  label: "Základní agent",
  description: "Rychlá klasifikace záměru jedním LLM krokem, poté spuštění příslušného subagenta.",
  mode: "basic",
  availableMcpTools: DEFAULT_AGENT_MCP_TOOL_KEYS
};
