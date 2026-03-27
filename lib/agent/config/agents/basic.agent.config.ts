import type { AgentDefinition } from "../types";

export const basicAgentConfig: AgentDefinition = {
  id: "basic",
  label: "Základní agent",
  description: "Rychlá klasifikace záměru jedním LLM krokem, poté spuštění příslušného subagenta.",
  mode: "basic"
};
