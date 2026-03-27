import { toJSONSchema } from "zod";
import { z } from "zod";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";

const ListMcpCapabilitiesInputSchema = z.object({
  /** Jen zaznamy s role=subagent */
  onlySubagents: z.boolean().optional(),
  /** Omezit na uvedene nazvy nastroju */
  names: z.array(z.string().min(1)).optional()
});

const CapabilityEntrySchema = z.object({
  name: z.string(),
  role: z.enum(["tool", "subagent"]),
  description: z.string(),
  auth: z.string(),
  sideEffects: z.array(z.string()),
  inputJsonSchema: z.unknown().optional(),
  outputJsonSchema: z.unknown().optional()
});

const ListMcpCapabilitiesOutputSchema = z.object({
  capabilities: z.array(CapabilityEntrySchema)
});

export type ListMcpCapabilitiesInput = z.infer<typeof ListMcpCapabilitiesInputSchema>;
export type ListMcpCapabilitiesOutput = z.infer<typeof ListMcpCapabilitiesOutputSchema>;

export function createListMcpCapabilitiesTool(
  getTools: () => Record<string, McpTool<unknown, unknown>>
): McpTool<ListMcpCapabilitiesInput, ListMcpCapabilitiesOutput> {
  return {
    contract: {
      role: "tool",
      name: "listMcpCapabilities",
      description:
        "Vrati seznam vsech registrovanych MCP nastroju a subagentu (role, popis, sideEffects, auth) " +
        "vcetne JSON Schema pro vstup a vystup podle Zod schemat. Volajici agent nebo orchestrator by mel nejdrive " +
        "zavolat tento nastroj, aby zjistil, co je k dispozici a jake parametry predat.",
      inputSchema: ListMcpCapabilitiesInputSchema,
      outputSchema: ListMcpCapabilitiesOutputSchema,
      auth: "service-role",
      sideEffects: []
    },
    run: async (_ctx: AgentToolContext, input: ListMcpCapabilitiesInput) => {
      const tools = getTools();
      const nameFilter = input.names?.length ? new Set(input.names) : null;

      const capabilities = Object.entries(tools)
        .filter(([key]) => (nameFilter ? nameFilter.has(key) : true))
        .map(([, tool]) => {
          const c = tool.contract;
          const role = c.role ?? "tool";
          if (input.onlySubagents && role !== "subagent") {
            return null;
          }
          let inputJsonSchema: unknown;
          let outputJsonSchema: unknown;
          try {
            inputJsonSchema = toJSONSchema(c.inputSchema);
          } catch {
            inputJsonSchema = undefined;
          }
          try {
            outputJsonSchema = toJSONSchema(c.outputSchema);
          } catch {
            outputJsonSchema = undefined;
          }
          return {
            name: c.name,
            role,
            description: c.description,
            auth: c.auth,
            sideEffects: c.sideEffects,
            inputJsonSchema,
            outputJsonSchema
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      return { capabilities };
    }
  };
}
