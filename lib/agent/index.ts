import { randomUUID } from "node:crypto";
import type { AgentAnswer } from "@/lib/agent/types";
import { classifyAgentIntent } from "@/lib/agent/llm/intent-classifier";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { WEEKLY_REPORT_DEFAULT_SLIDE_COUNT } from "@/lib/agent/defaults";
import { runAgentOrchestrator } from "@/lib/agent/orchestrator/agent-orchestrator";

function safeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

async function loadConversationContext(params: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  conversationId: string | null;
}) {
  if (!params.conversationId) return "";
  const { data, error } = await params.supabase
    .from("conversation_messages")
    .select("role, content")
    .eq("conversation_id", params.conversationId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error || !data) return "";

  return data
    .reverse()
    .map((msg) => `${safeText(msg.role)}: ${safeText(msg.content)}`)
    .join("\n");
}

export async function runBackOfficeAgent(input: {
  userId: string;
  question: string;
  conversationId?: string;
  options?: {
    presentation?: {
      slideCount?: number;
    };
  };
}): Promise<AgentAnswer> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const conversationId = input.conversationId ?? null;

  const contextText = await loadConversationContext({ supabase, conversationId });
  const classified = await classifyAgentIntent({
    runId,
    question: input.question,
    contextText: contextText || undefined
  });
  const intent = classified.intent;

  logger.info("agent_run_started", { runId, userId: input.userId, intent });

  if (conversationId) {
    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: input.question,
      metadata: { runId, intent }
    });
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("user_id", input.userId);
  }

  let answer: AgentAnswer;

  const explicitSlideCount = input.options?.presentation?.slideCount;
  const fromClassifier = classified.slideCount;
  const slideDefault = intent === "weekly_report" ? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT : 5;
  const resolvedSlideCount = Math.min(15, Math.max(2, explicitSlideCount ?? fromClassifier ?? slideDefault));

  answer = await runAgentOrchestrator({
    intent,
    ctx: { runId, userId: input.userId },
    question: input.question,
    contextText,
    slideCount: resolvedSlideCount
  });

  const finishedAt = new Date().toISOString();
  const { error } = await supabase.from("agent_runs").insert({
    run_id: runId,
    user_id: input.userId,
    question: input.question,
    intent,
    answer: answer.answer_text,
    confidence: answer.confidence,
    sources: answer.sources,
    created_at: startedAt,
    finished_at: finishedAt
  });

  if (error) {
    logger.warn("agent_run_audit_failed", { runId, message: error.message });
  }

  if (conversationId) {
    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: answer.answer_text,
      metadata: {
        runId,
        intent,
        confidence: answer.confidence,
        sources: answer.sources,
        generated_artifacts: answer.generated_artifacts,
        next_actions: answer.next_actions
      }
    });
    await supabase
      .from("conversations")
      .update({
        updated_at: new Date().toISOString(),
        title: input.question.slice(0, 60)
      })
      .eq("id", conversationId)
      .eq("user_id", input.userId);
  }

  logger.info("agent_run_finished", { runId, confidence: answer.confidence });
  return answer;
}
