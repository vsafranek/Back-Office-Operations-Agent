import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export type OutboundEmailAction = "draft_created" | "sent";

function excerpt(body: string, max = 400): string {
  const t = body.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * Zapisuje audit odchozího e-mailu (service role, bez RLS pro insert).
 */
export async function recordOutboundEmailEvent(params: {
  userId: string;
  conversationId?: string | null;
  agentRunId?: string | null;
  action: OutboundEmailAction;
  toEmail: string;
  subject: string;
  body?: string;
  gmailDraftId?: string | null;
  gmailMessageId?: string | null;
  /** Leady kontaktované tímto e-mailem (M:N přes outbound_email_event_leads). */
  leadIds?: string[] | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    const leadIds = params.leadIds?.length ? [...new Set(params.leadIds)] : [];
    const { data, error } = await supabase
      .from("outbound_email_events")
      .insert({
        user_id: params.userId,
        conversation_id: params.conversationId ?? null,
        agent_run_id: params.agentRunId ?? null,
        action: params.action,
        to_email: params.toEmail,
        subject: params.subject,
        body_excerpt: params.body != null ? excerpt(params.body) : null,
        gmail_draft_id: params.gmailDraftId ?? null,
        gmail_message_id: params.gmailMessageId ?? null,
        meta: params.meta ?? {}
      })
      .select("id")
      .maybeSingle();

    if (error) {
      logger.warn("outbound_email_audit_insert_failed", { message: error.message });
      return;
    }

    const eventId = data?.id;
    if (eventId && leadIds.length > 0) {
      const rows = leadIds.map((lead_id) => ({
        outbound_email_event_id: eventId,
        lead_id
      }));
      const { error: linkError } = await supabase.from("outbound_email_event_leads").insert(rows);
      if (linkError) {
        logger.warn("outbound_email_leads_link_failed", { message: linkError.message });
      }
    }
  } catch (e) {
    logger.warn("outbound_email_audit_exception", {
      message: e instanceof Error ? e.message : String(e)
    });
  }
}
