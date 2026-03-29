import { z } from "zod";
import { runSqlPreset } from "@/lib/agent/tools/sql-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";

const inputSchema = z.object({
  runId: z.string().min(3),
  question: z.string().min(3)
});

const outputSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  source: z.string(),
  preset: z.string(),
  rowTextNarrowing: z.string().optional(),
  filterLabel: z.string().optional(),
  suggestSourceChannelChart: z.boolean(),
  suggestDerivedCharts: z.boolean(),
  derivedChartKindHint: z.enum(["bar", "line", "pie"]).nullable().optional()
});

const tool: McpTool<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
  contract: {
    role: "tool",
    name: "runSqlPreset",
    description:
      "Nacti interni data: podle kontextu otazky se zvoli tabulka/view/RPC a volitelne textove zuzeni radku (bez noveho SQL od uzivatele).",
    inputSchema,
    outputSchema,
    auth: "service-role",
    sideEffects: []
  },
  run: async (ctx: AgentToolContext, input) =>
    runSqlPreset({
      question: input.question,
      runId: input.runId,
      trace: ctx.trace,
      traceParentId: ctx.traceParentId ?? null
    })
};

export const runSqlPresetTool: McpToolConfigEntry = { registryKey: "runSqlPreset", tool: tool as McpTool<unknown, unknown> };
