import { z } from "zod";
import { suggestViewingSlots } from "@/lib/agent/tools/calendar-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";

const inputSchema = z.object({
  userId: z.string().min(1),
  daysAhead: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().optional(),
  slotDurationMinutes: z.coerce.number().int().min(15).max(480).optional()
});

const rangeSchema = z.object({ start: z.string(), end: z.string() });

const outputSchema = z.object({
  slots: z.array(rangeSchema),
  busy: z.array(rangeSchema),
  rangeStart: z.string(),
  rangeEnd: z.string()
});

const tool: McpTool<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
  contract: {
    role: "tool",
    name: "suggestViewingSlots",
    description:
      "Návrh volných slotů pro prohlídku (začátky po 15 min, délka volitelná) + busy intervaly a časové okno (jedno volání free/busy + výpočet). " +
      "Jen pro prohlížení obsazenosti bez návrhu slotů použij browseCalendarAvailability.",
    inputSchema,
    outputSchema,
    auth: "service-role",
    sideEffects: []
  },
  run: async (_ctx: AgentToolContext, input) =>
    suggestViewingSlots({
      userId: input.userId,
      daysAhead: input.daysAhead,
      limit: input.limit,
      slotDurationMinutes: input.slotDurationMinutes
    })
};

export const suggestViewingSlotsTool: McpToolConfigEntry = {
  registryKey: "suggestViewingSlots",
  tool: tool as McpTool<unknown, unknown>
};
