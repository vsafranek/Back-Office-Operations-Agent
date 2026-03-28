import { z } from "zod";
import { createEmailDraft } from "@/lib/agent/tools/email-tool";
import { recordOutboundEmailEvent } from "@/lib/integrations/outbound-email-audit";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";

const inputSchema = z.object({
  userId: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(3),
  body: z.string().min(1),
  leadIds: z.array(z.string().uuid()).max(50).optional()
});

const outputSchema = z.object({
  draftId: z.string().nullable().optional(),
  messageId: z.string().nullable().optional()
});

const tool: McpTool<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
  contract: {
    role: "tool",
    name: "createEmailDraft",
    description:
      "Vytvoří draft e-mailu v Gmailu (neodesílá); zapíše audit draft_created. Odeslání: sendGmailOutbound (mode from_draft | direct). " +
      "Volitelně leadIds pro propojení s leady. Příchozí pošta: listGmailMessages + getGmailMessage.",
    inputSchema,
    outputSchema,
    auth: "service-role",
    sideEffects: ["Gmail draft create", "outbound_email_audit"]
  },
  run: async (ctx: AgentToolContext, input) => {
    const result = await createEmailDraft({
      userId: input.userId,
      to: input.to,
      subject: input.subject,
      body: input.body
    });
    const leadIds = input.leadIds?.length ? [...new Set(input.leadIds)] : undefined;
    await recordOutboundEmailEvent({
      userId: input.userId,
      conversationId: ctx.conversationId ?? null,
      agentRunId: ctx.runId,
      action: "draft_created",
      toEmail: input.to,
      subject: input.subject,
      body: input.body,
      gmailDraftId: result.draftId ?? null,
      gmailMessageId: result.messageId ?? null,
      leadIds
    });
    return result;
  }
};

export const createEmailDraftTool: McpToolConfigEntry = {
  registryKey: "createEmailDraft",
  tool: tool as McpTool<unknown, unknown>
};
