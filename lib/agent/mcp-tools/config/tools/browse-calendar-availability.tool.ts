import { z } from "zod";
import { browseCalendarAvailability } from "@/lib/agent/tools/calendar-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";

const inputSchema = z.object({
  userId: z.string().min(1),
  daysAhead: z.coerce.number().int().optional()
});

const rangeSchema = z.object({ start: z.string(), end: z.string() });

const outputSchema = z.object({
  busy: z.array(rangeSchema),
  rangeStart: z.string(),
  rangeEnd: z.string()
});

const tool: McpTool<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
  contract: {
    role: "tool",
    name: "browseCalendarAvailability",
    description:
      "Prohlížení kalendáře uživatele: obsazené úseky (Google Calendar free/busy) a časové okno dotazu. " +
      "Nepočítá návrhy konkrétních slotů prohlídky — k tomu použij suggestViewingSlots nebo odvození v kódu. " +
      "Vhodné pro experta na e-maily, který si nejdřív ověří obsazenost.",
    inputSchema,
    outputSchema,
    auth: "service-role",
    sideEffects: []
  },
  run: async (_ctx: AgentToolContext, input) =>
    browseCalendarAvailability({ userId: input.userId, daysAhead: input.daysAhead })
};

export const browseCalendarAvailabilityTool: McpToolConfigEntry = {
  registryKey: "browseCalendarAvailability",
  tool: tool as McpTool<unknown, unknown>
};
