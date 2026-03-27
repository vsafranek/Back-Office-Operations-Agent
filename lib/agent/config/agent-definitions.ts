import { basicAgentConfig } from "./agents/basic.agent.config";
import { thinkingOrchestratorAgentConfig } from "./agents/thinking-orchestrator.agent.config";
import type { AgentDefinition, AgentUiOption } from "./types";

/** Seznam agentů — bez validace MCP klíčů (ta běží jen na serveru v `registry.ts`). */
export const agentDefinitions: AgentDefinition[] = [basicAgentConfig, thinkingOrchestratorAgentConfig];

const byId = new Map(agentDefinitions.map((def) => [def.id, def]));

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
  return agentDefinitions.map((a) => a.id);
}

export function listAgentUiOptions(): AgentUiOption[] {
  return agentDefinitions.map(({ id, label, description, mode }) => ({ id, label, description, mode }));
}
