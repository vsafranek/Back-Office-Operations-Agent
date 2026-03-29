import { randomUUID } from "node:crypto";
import type { AgentAnswer } from "@/lib/agent/types";
import { getAgentDefinition } from "@/lib/agent/config/registry";
import { classifyAgentIntent, type ClassifiedAgentIntent } from "@/lib/agent/llm/intent-classifier";
import { applyPresentationIntentHeuristics } from "@/lib/agent/llm/intent-heuristics";
import { classifyWithThinkingOrchestrator } from "@/lib/agent/llm/thinking-orchestrator";
import { createAgentRunHandle } from "@/lib/agent/runtime/agent-run-handle";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { WEEKLY_REPORT_DEFAULT_SLIDE_COUNT } from "@/lib/agent/defaults";
import { runAgentOrchestrator } from "@/lib/agent/orchestrator/agent-orchestrator";
import { getMcpToolRunnerForAgent } from "@/lib/agent/mcp-tools/tool-registry";
import type { AgentRunProgress } from "@/lib/agent/types";
import { splitCompoundUserTasks } from "@/lib/agent/llm/compound-question-split";
import { mergeCompoundAgentAnswers } from "@/lib/agent/merge-compound-answers";
import {
  AGENT_PANEL_PAYLOAD_KEY,
  buildAgentPanelPersistPayload
} from "@/lib/agent/conversation/agent-panel-persist";

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
  /**
   * Předřazení ke klasifikaci a subagentům (např. systémové zadání naplánované úlohy).
   * Samotná otázka v konverzaci (pokud je) zůstává `question`.
   */
  orchestratorQuestionPrefix?: string;
  /**
   * Běh z uložené cron úlohy — klasifikátor nesmí zvolit `scheduled_agent_task` (jinak by se zacyklil návrh úlohy).
   */
  scheduledTaskExecution?: boolean;
  options?: {
    presentation?: {
      slideCount?: number;
    };
  };
  /** Volitelně: průběžné hlášky pro streaming UI (/api/agent/stream). */
  onProgress?: (event: AgentRunProgress) => void | Promise<void>;
  /** Tokeny úvahy thinking orchestrátoru (jen při streamovaném běhu). */
  onOrchestratorDelta?: (textChunk: string) => void | Promise<void>;
  /** Části finální uživatelské odpovědi (stream z LLM; jen jednodílné běhy, ne slepené podotázky). */
  onAnswerDelta?: (textChunk: string) => void | Promise<void>;
}): Promise<AgentAnswer> {
  const emit = async (phase: string) => {
    await input.onProgress?.({ phase });
  };

  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const conversationId = input.conversationId ?? null;
  const prefix = input.orchestratorQuestionPrefix?.trim();
  const effectiveQuestion = prefix
    ? `${prefix}\n\n--- Dotaz / šablona úlohy ---\n${input.question}`
    : input.question;

  const scheduledClassifierSuffix = input.scheduledTaskExecution
    ? "\n\n(Interní pokyn pro klasifikaci: probíhá vykonání již uložené naplánované úlohy. Intent scheduled_agent_task ani casual_chat NEPOUŽÍVEJ — zařaď požadavek podle obsahu mezi analytics, calendar_email, presentation, weekly_report, web_search, market_listings.)"
    : "";

  await emit("Zpracovávám dotaz…");
  const contextText = await loadConversationContext({ supabase, conversationId });
  await emit("Kontext konverzace načten.");
  const agentDef = getAgentDefinition(input.agentId);
  const handle = createAgentRunHandle({
    runId,
    userId: input.userId,
    conversationId
  });

  const seedQuestionForSplit = input.question.trim() || effectiveQuestion;

  const rootId = await handle.trace.record({
    parentId: null,
    kind: "orchestrator",
    name: "run.start",
    input: {
      agentId: agentDef.id,
      mode: agentDef.mode,
      questionPreview: effectiveQuestion.slice(0, 600),
      hasConversation: Boolean(conversationId)
    },
    meta: {
      actorType: "user",
      action: "agent.run.start",
      targetType: conversationId ? "conversation" : "adhoc",
      targetId: conversationId ?? undefined
    }
  });

  const traceRef = { recorder: handle.trace, parentId: rootId };

  const taskSeeds =
    input.scheduledTaskExecution || Boolean(prefix)
      ? [seedQuestionForSplit]
      : await splitCompoundUserTasks({
          question: seedQuestionForSplit,
          runId,
          trace: traceRef
        });

  const effectiveTasks = taskSeeds.map((t) =>
    prefix ? `${prefix}\n\n--- Dotaz / šablona úlohy ---\n${t}` : t
  );

  let classified: ClassifiedAgentIntent;
  let orchestrationReasoning: string | undefined;
  let intent: ClassifiedAgentIntent["intent"];
  let answer: AgentAnswer;

  const toolRunner = getMcpToolRunnerForAgent(agentDef);

  async function classifyOne(clsQuestion: string): Promise<{
    classified: ClassifiedAgentIntent;
    reasoning?: string;
  }> {
    if (agentDef.mode === "thinking") {
      const thinking = await classifyWithThinkingOrchestrator({
        runId,
        question: clsQuestion,
        contextText: contextText || undefined,
        extraInstructions: agentDef.orchestratorInstructions,
        trace: traceRef,
        onReasoningDelta: input.onOrchestratorDelta
      });
      return {
        classified: { intent: thinking.intent, slideCount: thinking.slideCount },
        reasoning: thinking.reasoning
      };
    }
    const c = await classifyAgentIntent({
      runId,
      question: clsQuestion,
      contextText: contextText || undefined,
      trace: traceRef
    });
    return { classified: c };
  }

  function resolveSlides(
    c: ClassifiedAgentIntent,
    intentVal: ClassifiedAgentIntent["intent"]
  ): number {
    const explicitSlideCount = input.options?.presentation?.slideCount;
    const fromClassifier = c.slideCount;
    const slideDefault =
      intentVal === "weekly_report" || intentVal === "presentation"
        ? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT
        : 5;
    return Math.min(14, Math.max(1, explicitSlideCount ?? fromClassifier ?? slideDefault));
  }

  if (effectiveTasks.length === 1) {
    const effectiveQuestionSingle = effectiveTasks[0]!;
    const classifierQuestion = effectiveQuestionSingle + scheduledClassifierSuffix;

    if (agentDef.mode === "thinking") {
      await emit("Orchestrátor promýšlí zadání a vhodné nástroje…");
    } else {
      await emit("Klasifikuji typ požadavku…");
    }

    const one = await classifyOne(classifierQuestion);
    classified = applyPresentationIntentHeuristics(one.classified, effectiveQuestionSingle);
    orchestrationReasoning = one.reasoning;
    intent = classified.intent;
    await emit(intentProgressLabel(intent));

    const resolvedSlideCount = resolveSlides(classified, intent);

    const dispatchId = await handle.trace.record({
      parentId: rootId,
      kind: "orchestrator",
      name: "intent.selected",
      input: {
        intent,
        reasoningPreview: orchestrationReasoning?.slice(0, 3000)
      },
      output: { slideCount: resolvedSlideCount },
      meta: {
        actorType: "user",
        action: "agent.intent.selected",
        targetType: "intent",
        targetId: intent
      }
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
        content: input.question.trim() ? input.question : effectiveQuestionSingle,
        metadata: { runId, intent, agentId: agentDef.id, agentMode: agentDef.mode }
      });
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("user_id", input.userId);
    }

    await emit("Spouštím podagenta a nástroje (může chvíli trvat)…");
    answer = await runAgentOrchestrator({
      intent,
      ctx: {
        runId,
        userId: input.userId,
        conversationId
      },
      question: effectiveQuestionSingle,
      contextText,
      slideCount: resolvedSlideCount,
      trace: handle.trace,
      traceDispatchId: dispatchId,
      toolRunner,
      onAnswerDelta: input.onAnswerDelta
    });
  } else {
    await emit(`Rozloženo na ${effectiveTasks.length} podotázky…`);

    logger.info("agent_run_started", {
      runId,
      userId: input.userId,
      intent: "compound",
      agentId: agentDef.id,
      mode: agentDef.mode,
      traceRootId: rootId,
      compoundParts: effectiveTasks.length
    });

    if (conversationId) {
      await supabase.from("conversation_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: input.question.trim() ? input.question : seedQuestionForSplit,
        metadata: {
          runId,
          agentId: agentDef.id,
          agentMode: agentDef.mode,
          compoundTasks: effectiveTasks.length
        }
      });
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("user_id", input.userId);
    }

    const reasoningChunks: string[] = [];
    const mergedParts: {
      taskLabel: string;
      answer: AgentAnswer;
      intent: ClassifiedAgentIntent["intent"];
    }[] = [];

    for (let i = 0; i < effectiveTasks.length; i++) {
      const eff = effectiveTasks[i]!;
      const clsQ = eff + scheduledClassifierSuffix;

      if (agentDef.mode === "thinking") {
        await emit(`Podotázka ${i + 1}/${effectiveTasks.length}: orchestrátor promýšlí…`);
      } else {
        await emit(`Podotázka ${i + 1}/${effectiveTasks.length}: klasifikuji…`);
      }

      const partMeta = await classifyOne(clsQ);
      if (partMeta.reasoning) reasoningChunks.push(partMeta.reasoning);

      const partClassified = applyPresentationIntentHeuristics(partMeta.classified, eff);
      const partIntent = partClassified.intent;
      await emit(
        `Podotázka ${i + 1}/${effectiveTasks.length}: ${intentProgressLabel(partIntent)}`
      );

      const partSlideCount = resolveSlides(partClassified, partIntent);

      const partDispatchId = await handle.trace.record({
        parentId: rootId,
        kind: "orchestrator",
        name: "intent.selected.compound_part",
        input: { partIndex: i, intent: partIntent },
        output: { slideCount: partSlideCount },
        meta: {
          actorType: "user",
          action: "agent.intent.selected.compound",
          targetType: "intent",
          targetId: partIntent
        }
      });

      await emit(`Podotázka ${i + 1}/${effectiveTasks.length}: spouštím podagenta…`);
      const partAnswer = await runAgentOrchestrator({
        intent: partIntent,
        ctx: {
          runId,
          userId: input.userId,
          conversationId,
          artifactStorageKey: `${runId}-p${i}`
        },
        question: eff,
        contextText,
        slideCount: partSlideCount,
        trace: handle.trace,
        traceDispatchId: partDispatchId,
        toolRunner,
        onAnswerDelta: undefined
      });

      const labelRaw = taskSeeds[i] ?? eff;
      const shortLabel = labelRaw.length > 100 ? `${labelRaw.slice(0, 97)}…` : labelRaw;
      mergedParts.push({ taskLabel: shortLabel, answer: partAnswer, intent: partIntent });
    }

    answer = mergeCompoundAgentAnswers({ parts: mergedParts });
    intent = answer.intent ?? "analytics";
    orchestrationReasoning = reasoningChunks.length ? reasoningChunks.join("\n---\n") : undefined;
  }

  answer = {
    ...answer,
    runId,
    intent,
    orchestration: {
      agentId: agentDef.id,
      mode: agentDef.mode,
      ...(orchestrationReasoning ? { reasoning: orchestrationReasoning } : {})
    }
  };

  await emit("Ukládám výsledek a audit…");
  const finishedAt = new Date().toISOString();
  const auditQuestion =
    effectiveTasks.length > 1 ? taskSeeds.join(" · ") : effectiveTasks[0] ?? effectiveQuestion;
  const { error } = await supabase.from("agent_runs").insert({
    run_id: runId,
    user_id: input.userId,
    question: auditQuestion,
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
    const panelPayload = buildAgentPanelPersistPayload(answer);
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
        next_actions: answer.next_actions,
        ...(panelPayload ? { [AGENT_PANEL_PAYLOAD_KEY]: panelPayload } : {})
      }
    });
    await supabase
      .from("conversations")
      .update({
        updated_at: new Date().toISOString(),
        title: (input.question.trim() ? input.question : effectiveQuestion).slice(0, 60)
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
    web_search: "Záměr: vyhledávání na webu — připravuji odpověď…",
    market_listings: "Záměr: nabídky Sreality / Bezrealitky — stahuji data…",
    scheduled_agent_task: "Záměr: naplánovaná opakovaná úloha agenta — připravuji návrh pro potvrzení…",
    casual_chat: "Neformální zpráva — krátká odpověď bez webu…"
  };
  return labels[intent];
}
