import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { logger } from "@/lib/observability/logger";

/**
 * Zápis do workflow_runs po HTTP enqueue z agenta (BOA-007).
 */
export async function recordExternalWorkflowEnqueue(params: {
  endpoint: string;
  payload: Record<string, unknown>;
  httpStatus: number;
  ok: boolean;
  errorText?: string | null;
  responsePreview?: unknown;
  agentContext?: { runId: string; userId: string; conversationId?: string | null };
}): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    const run_ref = randomUUID();
    const err =
      params.ok ? null : (params.errorText?.trim().slice(0, 4000) ?? `HTTP ${params.httpStatus}`);
    const { error } = await supabase.from("workflow_runs").insert({
      workflow_name: "external_http_enqueue",
      run_ref,
      status: params.ok ? "completed" : "failed",
      finished_at: new Date().toISOString(),
      error_message: err,
      triggered_by: params.agentContext ? "agent" : "unknown",
      actor_user_id: params.agentContext?.userId ?? null,
      metadata: {
        endpoint: params.endpoint,
        httpStatus: params.httpStatus,
        responsePreview: params.responsePreview,
        agentRunId: params.agentContext?.runId ?? null,
        conversationId: params.agentContext?.conversationId ?? null,
        payloadKeys: Object.keys(params.payload).slice(0, 40)
      }
    });
    if (error) {
      logger.warn("workflow_enqueue_audit_failed", { message: error.message });
    }
  } catch (e) {
    logger.warn("workflow_enqueue_audit_exception", {
      message: e instanceof Error ? e.message : String(e)
    });
  }
}
