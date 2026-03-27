import { randomUUID } from "node:crypto";
import type { AgentAnswer } from "@/lib/agent/types";
import { getAgentDefinition } from "@/lib/agent/config/registry";
import { classifyAgentIntent, type ClassifiedAgentIntent } from "@/lib/agent/llm/intent-classifier";
import { classifyWithThinkingOrchestrator } from "@/lib/agent/llm/thinking-orchestrator";
import { createAgentRunHandle } from "@/lib/agent/runtime/agent-run-handle";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { WEEKLY_REPORT_DEFAULT_SLIDE_COUNT } from "@/lib/agent/defaults";
import { runAgentOrchestrator } from "@/lib/agent/orchestrator/agent-orchestrator";
import { getMcpToolRunnerForAgent } from "@/lib/agent/mcp-tools/tool-registry";
import type { AgentRunProgress } from "@/lib/agent/types";

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
  /** Viz `lib/agent/config/registry.ts` – např. basic | thinking-orchestrator */
  agentId?: string;
  options?: {
    presentation?: {
      slideCount?: number;
    };
  };
  /** Volitelně: průběžné hlášky pro streaming UI (/api/agent/stream). */
  onProgress?: (event: AgentRunProgress) => void | Promise<void>;
  /** Tokeny úvahy thinking orchestrátoru (jen při streamovaném běhu). */
  onOrchestratorDelta?: (textChunk: string) => void | Promise<void>;
}): Promise<AgentAnswer> {
  const emit = async (phase: string) => {
    await input.onProgress?.({ phase });
  };

  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const conversationId = input.conversationId ?? null;

  await emit("Zpracovávám dotaz…");
  const contextText = await loadConversationContext({ supabase, conversationId });
  await emit("Kontext konverzace načten.");
  const agentDef = getAgentDefinition(input.agentId);
  const handle = createAgentRunHandle({
    runId,
    userId: input.userId,
    conversationId
  });

  const rootId = await handle.trace.record({
    parentId: null,
    kind: "orchestrator",
    name: "run.start",
    input: {
      agentId: agentDef.id,
      mode: agentDef.mode,
      questionPreview: input.question.slice(0, 600),
      hasConversation: Boolean(conversationId)
    }
  });

  const traceRef = { recorder: handle.trace, parentId: rootId };

  let classified: ClassifiedAgentIntent;
  let orchestrationReasoning: string | undefined;

  if (agentDef.mode === "thinking") {
    await emit("Orchestrátor promýšlí zadání a vhodné nástroje…");
    const thinking = await classifyWithThinkingOrchestrator({
      runId,
      question: input.question,
      contextText: contextText || undefined,
      extraInstructions: agentDef.orchestratorInstructions,
      trace: traceRef,
      onReasoningDelta: input.onOrchestratorDelta
    });
    classified = { intent: thinking.intent, slideCount: thinking.slideCount };
    orchestrationReasoning = thinking.reasoning;
  } else {
    await emit("Klasifikuji typ požadavku…");
    classified = await classifyAgentIntent({
      runId,
      question: input.question,
      contextText: contextText || undefined,
      trace: traceRef
    });
  }

  const intent = classified.intent;
  await emit(intentProgressLabel(intent));

  const explicitSlideCount = input.options?.presentation?.slideCount;
  const fromClassifier = classified.slideCount;
  const slideDefault =
    intent === "weekly_report" || intent === "presentation" ? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT : 5;
  const resolvedSlideCount = Math.min(15, Math.max(2, explicitSlideCount ?? fromClassifier ?? slideDefault));

  const dispatchId = await handle.trace.record({
    parentId: rootId,
    kind: "orchestrator",
    name: "intent.selected",
    input: {
      intent,
      reasoningPreview: orchestrationReasoning?.slice(0, 3000)
    },
    output: { slideCount: resolvedSlideCount }
  });

  logger.info("agent_run_started", {
    runId,
    userId: input.userId,
    intent,
    agentId: agentDef.id,
    mode: agentDef.mode,
    traceRootId: rootId
  });

  if (conversationId) {
    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: input.question,
      metadata: { runId, intent, agentId: agentDef.id, agentMode: agentDef.mode }
    });
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("user_id", input.userId);
  }

  let answer: AgentAnswer;

  const toolRunner = getMcpToolRunnerForAgent(agentDef);

  await emit("Spouštím podagenta a nástroje (může chvíli trvat)…");
  answer = await runAgentOrchestrator({
    intent,
    ctx: {
      runId,
      userId: input.userId,
      conversationId
    },
    question: input.question,
    contextText,
    slideCount: resolvedSlideCount,
    trace: handle.trace,
    traceDispatchId: dispatchId,
    toolRunner
  });

  answer = {
    ...answer,
    runId,
    orchestration: {
      agentId: agentDef.id,
      mode: agentDef.mode,
      ...(orchestrationReasoning ? { reasoning: orchestrationReasoning } : {})
    }
  };

  await emit("Ukládám výsledek a audit…");
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
        agentId: agentDef.id,
        agentMode: agentDef.mode,
        orchestration: answer.orchestration,
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
  await emit("Hotovo.");
  return answer;
}

function intentProgressLabel(intent: ClassifiedAgentIntent["intent"]): string {
  const labels: Record<ClassifiedAgentIntent["intent"], string> = {
    analytics: "Záměr: analytika nad interními daty — připravuji odpověď…",
    calendar_email: "Záměr: kalendář a e-mail — připravuji odpověď…",
    presentation: "Záměr: prezentace — připravuji odpověď…",
    weekly_report: "Záměr: týdenní report — připravuji odpověď…",
    web_search: "Záměr: vyhledávání na webu — připravuji odpověď…"
  };
  return labels[intent];
}
