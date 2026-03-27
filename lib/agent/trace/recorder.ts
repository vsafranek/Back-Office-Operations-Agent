import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export type TraceKind = "orchestrator" | "subagent" | "llm" | "tool";

export type AgentTraceRecorderOptions = {
  runId: string;
  userId: string;
  conversationId: string | null;
};

export class AgentTraceRecorder {
  private step = 0;

  constructor(private readonly opts: AgentTraceRecorderOptions) {}

  async record(params: {
    parentId: string | null;
    kind: TraceKind;
    name: string;
    status?: "success" | "error";
    input?: unknown;
    output?: unknown;
    errorMessage?: string | null;
    durationMs?: number | null;
    meta?: Record<string, unknown>;
  }): Promise<string | null> {
    const step_index = this.step;
    this.step += 1;

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("agent_trace_events")
        .insert({
          run_id: this.opts.runId,
          user_id: this.opts.userId,
          conversation_id: this.opts.conversationId,
          parent_id: params.parentId,
          step_index,
          kind: params.kind,
          name: params.name,
          status: params.status ?? "success",
          input_payload: params.input ?? null,
          output_payload: params.output ?? null,
          error_message: params.errorMessage ?? null,
          duration_ms: params.durationMs ?? null,
          meta: params.meta ?? {}
        })
        .select("id")
        .maybeSingle();

      if (error) {
        logger.warn("trace_record_failed", { runId: this.opts.runId, message: error.message });
        return null;
      }

      return data?.id ?? null;
    } catch (e) {
      logger.warn("trace_record_exception", {
        runId: this.opts.runId,
        message: e instanceof Error ? e.message : "unknown"
      });
      return null;
    }
  }
}

