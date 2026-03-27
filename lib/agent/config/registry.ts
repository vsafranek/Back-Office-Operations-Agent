import { basicAgentConfig } from "./agents/basic.agent.config";
import { thinkingOrchestratorAgentConfig } from "./agents/thinking-orchestrator.agent.config";
import type { AgentDefinition, AgentUiOption } from "./types";
import { assertAgentMcpToolsValid } from "./validate-agent-mcp-tools";

const list: AgentDefinition[] = [basicAgentConfig, thinkingOrchestratorAgentConfig];

for (const def of list) {
  assertAgentMcpToolsValid(def);
}

const byId = new Map(list.map((def) => [def.id, def]));

/** Výchozí orchestrátor podle produktové definice (thinking). */
export const DEFAULT_AGENT_ID = thinkingOrchestratorAgentConfig.id;

export function getAgentDefinition(agentId: string | undefined): AgentDefinition {
  const id = agentId?.trim() || DEFAULT_AGENT_ID;
  const found = byId.get(id);
  if (!found) {
    throw new Error(`Unknown agent id: ${id}`);
  }
  return found;
}

export function listAgentIds(): string[] {
  return list.map((a) => a.id);
}

export function listAgentUiOptions(): AgentUiOption[] {
  return list.map(({ id, label, description, mode }) => ({ id, label, description, mode }));
}
