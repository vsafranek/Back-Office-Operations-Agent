import { z } from "zod";
import { createEmailDraft } from "@/lib/agent/tools/email-tool";
import { recordOutboundEmailEvent } from "@/lib/integrations/outbound-email-audit";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(100_000),
  conversationId: z.string().uuid().optional().nullable(),
  agentRunId: z.string().min(3).max(200).optional().nullable(),
  leadIds: z.array(z.string().uuid()).max(50).optional()
});

/**
 * Vytvoří draft e-mailu (Gmail nebo Outlook podle mail_provider v integracích).
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

    const result = await createEmailDraft({
      userId: user.id,
      to: parsed.data.to,
      subject: parsed.data.subject,
      body: parsed.data.body
    });

    await recordOutboundEmailEvent({
      userId: user.id,
      conversationId: parsed.data.conversationId ?? null,
      agentRunId: parsed.data.agentRunId ?? null,
      action: "draft_created",
      toEmail: parsed.data.to,
      subject: parsed.data.subject,
      body: parsed.data.body,
      gmailDraftId: result.draftId ?? null,
      gmailMessageId: result.messageId ?? null,
      leadIds: parsed.data.leadIds?.length ? [...new Set(parsed.data.leadIds)] : undefined
    });

    return Response.json({
      draftId: result.draftId ?? null,
      messageId: result.messageId ?? null
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
