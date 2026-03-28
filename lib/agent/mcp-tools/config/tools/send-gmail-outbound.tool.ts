import { z } from "zod";
import { sendGmailDraft, sendGmailMessageNow } from "@/lib/agent/tools/email-tool";
import { recordOutboundEmailEvent } from "@/lib/integrations/outbound-email-audit";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";

const leadIdsSchema = z.array(z.string().uuid()).max(50).optional();

const inputSchema = z.discriminatedUnion("mode", [
  z.object({
    userId: z.string().min(1),
    mode: z.literal("from_draft"),
    draftId: z.string().min(2),
    to: z.string().email(),
    subject: z.string().min(1).max(500),
    body: z.string().min(1).max(100_000),
    leadIds: leadIdsSchema
  }),
  z.object({
    userId: z.string().min(1),
    mode: z.literal("direct"),
    to: z.string().email(),
    subject: z.string().min(1).max(500),
    body: z.string().min(1).max(100_000),
    leadIds: leadIdsSchema
  })
]);

const outputSchema = z.object({
  messageId: z.string().nullable(),
  threadId: z.string().nullable()
});

const tool: McpTool<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
  contract: {
    role: "tool",
    name: "sendGmailOutbound",
    description:
      "Odeslání e-mailu z Gmailu (nevratné). Režim `from_draft` odešle existující draft (createEmailDraft → tento krok). " +
      "Režim `direct` pošle zprávu rovnou bez uložení draftu. Volitelně `leadIds` pro audit „které leady byly kontaktovány“. " +
      "Pro jen uložení bez odeslání použij createEmailDraft.",
    inputSchema,
    outputSchema,
    auth: "service-role",
    sideEffects: ["Gmail send", "outbound_email_audit"]
  },
  run: async (ctx: AgentToolContext, input) => {
    const leadIds = input.leadIds?.length ? [...new Set(input.leadIds)] : undefined;
    if (input.mode === "from_draft") {
      const sent = await sendGmailDraft({ userId: input.userId, draftId: input.draftId });
      await recordOutboundEmailEvent({
        userId: input.userId,
        conversationId: ctx.conversationId ?? null,
        agentRunId: ctx.runId,
        action: "sent",
        toEmail: input.to,
        subject: input.subject,
        body: input.body,
        gmailDraftId: input.draftId,
        gmailMessageId: sent.messageId,
        leadIds,
        meta: { threadId: sent.threadId ?? undefined, via: "mcp_sendGmailOutbound", mode: "from_draft" }
      });
      return sent;
    }
    const sent = await sendGmailMessageNow({
      userId: input.userId,
      to: input.to,
      subject: input.subject,
      body: input.body
    });
    await recordOutboundEmailEvent({
      userId: input.userId,
      conversationId: ctx.conversationId ?? null,
      agentRunId: ctx.runId,
      action: "sent",
      toEmail: input.to,
      subject: input.subject,
      body: input.body,
      gmailDraftId: null,
      gmailMessageId: sent.messageId,
      leadIds,
      meta: { threadId: sent.threadId ?? undefined, via: "mcp_sendGmailOutbound", mode: "direct" }
    });
    return sent;
  }
};

export const sendGmailOutboundTool: McpToolConfigEntry = {
  registryKey: "sendGmailOutbound",
  tool: tool as McpTool<unknown, unknown>
};
