import { z } from "zod";
import { createEmailDraft } from "@/lib/agent/tools/email-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";

const inputSchema = z.object({
  userId: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(3),
  body: z.string().min(1)
});

const outputSchema = z.object({
  draftId: z.string().nullable().optional(),
  messageId: z.string().nullable().optional()
});

const tool: McpTool<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
  contract: {
    role: "tool",
    name: "createEmailDraft",
    description: "Vytvoří draft emailu v Gmailu (nikdy neodesílá).",
    inputSchema,
    outputSchema,
    auth: "service-role",
    sideEffects: ["Gmail draft create"]
  },
  run: async (_ctx: AgentToolContext, input) =>
    createEmailDraft({
      userId: input.userId,
      to: input.to,
      subject: input.subject,
      body: input.body
    })
};

export const createEmailDraftTool: McpToolConfigEntry = {
  registryKey: "createEmailDraft",
  tool: tool as McpTool<unknown, unknown>
};
