import { z } from "zod";
import { sendGmailDraft, sendGmailMessageNow } from "@/lib/agent/tools/email-tool";
import { recordOutboundEmailEvent } from "@/lib/integrations/outbound-email-audit";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

const sharedFields = {
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(100_000),
  conversationId: z.string().uuid().optional().nullable(),
  agentRunId: z.string().min(3).max(200).optional().nullable(),
  leadIds: z.array(z.string().uuid()).max(50).optional()
};

const bodySchema = z.discriminatedUnion("strategy", [
  z.object({
    strategy: z.literal("from_draft"),
    confirmSend: z.literal(true),
    draftId: z.string().min(2).max(200),
    ...sharedFields
  }),
  z.object({
    strategy: z.literal("direct"),
    confirmSend: z.literal(true),
    ...sharedFields
  })
]);

/**
 * Odešle e-mail (Gmail nebo Outlook podle mail_provider).
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Neplatné parametry.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const leadIds = parsed.data.leadIds?.length ? [...new Set(parsed.data.leadIds)] : undefined;

    if (parsed.data.strategy === "from_draft") {
      const sent = await sendGmailDraft({
        userId: user.id,
        draftId: parsed.data.draftId
      });

      await recordOutboundEmailEvent({
        userId: user.id,
        conversationId: parsed.data.conversationId ?? null,
        agentRunId: parsed.data.agentRunId ?? null,
        action: "sent",
        toEmail: parsed.data.to,
        subject: parsed.data.subject,
        body: parsed.data.body,
        gmailDraftId: parsed.data.draftId,
        gmailMessageId: sent.messageId,
        leadIds,
        meta: { threadId: sent.threadId ?? undefined, strategy: "from_draft" }
      });

      return Response.json({
        messageId: sent.messageId,
        threadId: sent.threadId
      });
    }

    const sent = await sendGmailMessageNow({
      userId: user.id,
      to: parsed.data.to,
      subject: parsed.data.subject,
      body: parsed.data.body
    });

    await recordOutboundEmailEvent({
      userId: user.id,
      conversationId: parsed.data.conversationId ?? null,
      agentRunId: parsed.data.agentRunId ?? null,
      action: "sent",
      toEmail: parsed.data.to,
      subject: parsed.data.subject,
      body: parsed.data.body,
      gmailDraftId: null,
      gmailMessageId: sent.messageId,
      leadIds,
      meta: { threadId: sent.threadId ?? undefined, strategy: "direct" }
    });

    return Response.json({
      messageId: sent.messageId,
      threadId: sent.threadId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer")
        ? 401
        : 500;
    return Response.json({ error: message }, { status });
  }
}
