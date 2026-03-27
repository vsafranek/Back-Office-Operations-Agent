export type AgentMode = "basic" | "thinking";

export type AgentDefinition = {
  id: string;
  label: string;
  description: string;
  mode: AgentMode;
  /** Doplnkové pokyny pro thinking režim (před klasifikací záměru). */
  orchestratorInstructions?: string;
};

export type AgentUiOption = Pick<AgentDefinition, "id" | "label" | "description" | "mode">;
