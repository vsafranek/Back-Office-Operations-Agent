import { z } from "zod";
import { enqueueWorkflowTask } from "@/lib/agent/tools/workflow-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";

const inputSchema = z.object({
  endpoint: z.string().min(3),
  payload: z.record(z.string(), z.unknown()).default({})
});

const outputSchema = z.any();

const tool: McpTool<z.infer<typeof inputSchema>, unknown> = {
  contract: {
    role: "tool",
    name: "enqueueWorkflowTask",
    description: "Zařadí úlohu do externího workflow endpointu.",
    inputSchema,
    outputSchema,
    auth: "service-role",
    sideEffects: ["External HTTP POST", "workflow_runs audit"]
  },
  run: async (ctx: AgentToolContext, input) =>
    enqueueWorkflowTask({
      endpoint: input.endpoint,
      payload: input.payload,
      agentContext: {
        runId: ctx.runId,
        userId: ctx.userId,
        conversationId: ctx.conversationId ?? null
      }
    })
};

export const enqueueWorkflowTaskTool: McpToolConfigEntry = {
  registryKey: "enqueueWorkflowTask",
  tool: tool as McpTool<unknown, unknown>
};
