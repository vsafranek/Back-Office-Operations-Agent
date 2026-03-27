import "server-only";

import { agentDefinitions } from "./agent-definitions";
import { assertAgentMcpToolsValid } from "./validate-agent-mcp-tools";

for (const def of agentDefinitions) {
  assertAgentMcpToolsValid(def);
}

export { DEFAULT_AGENT_ID, getAgentDefinition, listAgentIds, listAgentUiOptions } from "./agent-definitions";
