import type { McpToolRegistryKey } from "@/lib/agent/mcp-tools/config/assemble-registry";

export type AgentMode = "basic" | "thinking";

export type AgentDefinition = {
  id: string;
  label: string;
  description: string;
  mode: AgentMode;
  /** Doplnkové pokyny pro thinking režim (před klasifikací záměru). */
  orchestratorInstructions?: string;
  /**
   * MCP nastroje / specialiste (vcetne runPresentationAgent), ktere tento agent smi volat.
   * Krome toho vznikne omezena mapa s listMcpCapabilities nad touto podmnozinou.
   */
  availableMcpTools: readonly McpToolRegistryKey[];
};

export type AgentUiOption = Pick<AgentDefinition, "id" | "label" | "description" | "mode">;
