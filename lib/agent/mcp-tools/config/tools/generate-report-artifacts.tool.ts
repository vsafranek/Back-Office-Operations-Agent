import { z } from "zod";
import { generateReportArtifacts } from "@/lib/agent/tools/report-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";

const inputSchema = z.object({
  runId: z.string().min(3),
  title: z.string().min(3),
  rows: z.array(z.record(z.string(), z.unknown()))
});

const outputSchema = z.object({
  csvPublic: z.string().url(),
  mdPublic: z.string().url()
});

const tool: McpTool<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
  contract: {
    role: "tool",
    name: "generateReportArtifacts",
    description: "Vygeneruje CSV dataset a Markdown summary z dat a nahraje je do Supabase Storage.",
    inputSchema,
    outputSchema,
    auth: "service-role",
    sideEffects: ["Storage upload (CSV + MD) do bucketu env.SUPABASE_STORAGE_BUCKET"]
  },
  run: async (_ctx: AgentToolContext, input) =>
    generateReportArtifacts({ runId: input.runId, title: input.title, rows: input.rows })
};

export const generateReportArtifactsTool: McpToolConfigEntry = {
  registryKey: "generateReportArtifacts",
  tool: tool as McpTool<unknown, unknown>
};
