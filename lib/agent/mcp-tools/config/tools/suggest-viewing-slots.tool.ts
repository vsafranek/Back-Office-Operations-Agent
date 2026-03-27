import { z } from "zod";
import { suggestViewingSlots } from "@/lib/agent/tools/calendar-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";

const inputSchema = z.object({
  userId: z.string().min(1),
  daysAhead: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().optional()
});

const outputSchema = z.array(
  z.object({
    start: z.string(),
    end: z.string()
  })
);

const tool: McpTool<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
  contract: {
    role: "tool",
    name: "suggestViewingSlots",
    description: "Doporuči volné časové sloty pro prohlídku z Google Calendar (free/busy).",
    inputSchema,
    outputSchema,
    auth: "service-role",
    sideEffects: []
  },
  run: async (_ctx: AgentToolContext, input) =>
    suggestViewingSlots({ userId: input.userId, daysAhead: input.daysAhead, limit: input.limit })
};

export const suggestViewingSlotsTool: McpToolConfigEntry = {
  registryKey: "suggestViewingSlots",
  tool: tool as McpTool<unknown, unknown>
};
