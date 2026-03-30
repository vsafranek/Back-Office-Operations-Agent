import { WEEKLY_REPORT_DEFAULT_SLIDE_COUNT } from "@/lib/agent/defaults";
import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { runAnalyticsSubAgent } from "@/lib/agent/subagents/analytics-subagent";
import { runCalendarEmailSubAgent } from "@/lib/agent/subagents/calendar-email-subagent";
import { runPresentationSubAgent } from "@/lib/agent/subagents/presentation-subagent";
import { runWeeklyReportSubAgent } from "@/lib/agent/subagents/weekly-report-subagent";
import { runWebSearchSubAgent } from "@/lib/agent/subagents/web-search-subagent";
import { runMarketListingsChatSubAgent } from "@/lib/agent/subagents/market-listings-chat-subagent";
import { runScheduledTaskProposalSubAgent } from "@/lib/agent/subagents/scheduled-task-proposal-subagent";
import { runCasualChatSubAgent } from "@/lib/agent/subagents/casual-chat-subagent";
import { runPresentationFromRowsSubAgent } from "@/lib/agent/subagents/presentation-subagent";
import { parseTaskCapabilities } from "@/lib/agent/llm/task-capabilities";

export type AgentIntent =
  | "analytics"
  | "calendar_email"
  | "presentation"
  | "weekly_report"
  | "web_search"
  | "market_listings"
  | "scheduled_agent_task"
  | "casual_chat";

type PlannedStep =
  | "analytics"
  | "analytics_presentation"
  | "calendar_email"
  | "presentation"
  | "weekly_report"
  | "web_search"
  | "market_listings"
  | "market_listings_presentation"
  | "scheduled_agent_task"
  | "casual_chat";

type InitialPlan = {
  steps: PlannedStep[];
};

function planSteps(params: {
  intent: AgentIntent;
  question: string;
}): PlannedStep[] {
  const caps = parseTaskCapabilities(params.question);
  if (params.intent === "analytics") {
    return caps.needsPresentation
      ? ["analytics", "analytics_presentation"]
      : ["analytics"];
  }
  if (params.intent === "market_listings") {
    return caps.needsPresentation
      ? ["market_listings", "market_listings_presentation"]
      : ["market_listings"];
  }
  return [params.intent];
}

function buildInitialPlan(params: { intent: AgentIntent; question: string }): InitialPlan {
  return { steps: planSteps(params) };
}

function extractRowsForPresentation(answer: AgentAnswer): Record<string, unknown>[] {
  const panel = answer.dataPanel;
  if (!panel) return [];
  if (panel.kind === "clients_q1") return panel.rows;
  if (panel.kind === "leads_sales_6m") return panel.rows;
  if (panel.kind === "clients_filtered") return panel.rows;
  if (panel.kind === "deal_sales_detail") return panel.rows;
  if (panel.kind === "missing_reconstruction") return panel.rows;
  if (panel.kind === "market_listings") {
    return panel.listings.map((l) => ({
      title: l.title,
      location: l.location,
      source: l.source,
      url: l.url,
      price_czk: l.price_czk ?? null
    }));
  }
  return [];
}

function shouldRunStep(params: {
  step: PlannedStep;
  currentAnswer: AgentAnswer | null;
}): { ok: boolean; reason?: string } {
  if (params.step === "market_listings_presentation") {
    const rows = params.currentAnswer ? extractRowsForPresentation(params.currentAnswer) : [];
    if (rows.length === 0) {
      return {
        ok: false,
        reason: "Prezentaci přeskakuji, protože předchozí krok nevrátil žádná data z nabídek."
      };
    }
  }
  if (params.step === "analytics_presentation") {
    const rows = params.currentAnswer ? extractRowsForPresentation(params.currentAnswer) : [];
    if (rows.length === 0) {
      return {
        ok: false,
        reason: "Prezentaci přeskakuji, protože analytický krok nevrátil tabulková data."
      };
    }
  }
  return { ok: true };
}

function replanRemainingSteps(params: {
  remainingSteps: PlannedStep[];
  currentAnswer: AgentAnswer | null;
}): { steps: PlannedStep[]; note?: string } {
  const rows = params.currentAnswer ? extractRowsForPresentation(params.currentAnswer) : [];
  if (rows.length > 0) return { steps: params.remainingSteps };

  const removed = params.remainingSteps.filter((s) => s === "analytics_presentation" || s === "market_listings_presentation");
  if (removed.length === 0) return { steps: params.remainingSteps };

  const steps = params.remainingSteps.filter((s) => s !== "analytics_presentation" && s !== "market_listings_presentation");
  return {
    steps,
    note: "Plán upraven podle kontextu: krok prezentace byl přeskočen, protože nejsou dostupná tabulková data."
  };
}

function mergeStepAnswers(base: AgentAnswer, extra: AgentAnswer): AgentAnswer {
  const text = [base.answer_text?.trim(), extra.answer_text?.trim()].filter(Boolean).join("\n\n");
  return {
    ...base,
    answer_text: text || base.answer_text || extra.answer_text,
    confidence: Math.min(base.confidence ?? 1, extra.confidence ?? 1),
    sources: [...new Set([...(base.sources ?? []), ...(extra.sources ?? [])])],
    generated_artifacts: [...(base.generated_artifacts ?? []), ...(extra.generated_artifacts ?? [])],
    next_actions: [...new Set([...(base.next_actions ?? []), ...(extra.next_actions ?? [])])]
  };
}

export async function runAgentOrchestrator(params: {
  intent: AgentIntent;
  ctx: AgentToolContext;
  question: string;
  contextText: string;
  slideCount?: number;
  trace?: AgentTraceRecorder;
  traceDispatchId?: string | null;
  toolRunner: ToolRunner;
  onAnswerDelta?: (chunk: string) => void | Promise<void>;
}): Promise<AgentAnswer> {
  const { toolRunner } = params;

  let traceParentId = params.traceDispatchId ?? null;
  if (params.trace && traceParentId) {
    const subId = await params.trace.record({
      parentId: traceParentId,
      kind: "subagent",
      name: params.intent,
      input: { questionPreview: params.question.slice(0, 800) }
    });
    if (subId) traceParentId = subId;
  }

  const ctx: AgentToolContext = {
    runId: params.ctx.runId,
    userId: params.ctx.userId,
    conversationId: params.ctx.conversationId ?? null,
    trace: params.trace,
    traceParentId
  };

  // Phase 1: upfront plan what steps/subagents to run.
  const initialPlan = buildInitialPlan({ intent: params.intent, question: params.question });
  let steps = [...initialPlan.steps];
  let composedAnswer: AgentAnswer | null = null;

  while (steps.length > 0) {
    const step = steps.shift()!;
    // Phase 2: context-aware guard before each next step.
    const gate = shouldRunStep({ step, currentAnswer: composedAnswer });
    if (!gate.ok) {
      const skipAnswer: AgentAnswer = {
        answer_text: gate.reason ?? "Další krok byl přeskočen.",
        confidence: 0.8,
        sources: [],
        generated_artifacts: [],
        next_actions: []
      };
      composedAnswer = composedAnswer ? mergeStepAnswers(composedAnswer, skipAnswer) : skipAnswer;
      continue;
    }

    let stepAnswer: AgentAnswer;

    if (step === "calendar_email") {
      stepAnswer = await runCalendarEmailSubAgent({
        toolRunner,
        ctx,
        question: params.question,
        contextText: params.contextText,
        onAnswerDelta: params.onAnswerDelta
      });
    } else if (step === "presentation") {
      const slideCount = Math.min(14, Math.max(1, params.slideCount ?? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT));
      const title = params.question.trim().slice(0, 120) || "Prezentace";
      stepAnswer = await runPresentationSubAgent({
        toolRunner,
        ctx,
        slideCount,
        question: params.question,
        title,
        onAnswerDelta: params.onAnswerDelta
      });
    } else if (step === "weekly_report") {
      const slideCount = Math.min(14, Math.max(1, params.slideCount ?? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT));
      const title = params.question.trim().slice(0, 120) || "Prezentacni report";
      stepAnswer = await runWeeklyReportSubAgent({
        toolRunner,
        ctx,
        slideCount,
        question: params.question,
        title,
        onAnswerDelta: params.onAnswerDelta
      });
    } else if (step === "web_search") {
      stepAnswer = await runWebSearchSubAgent({
        toolRunner,
        ctx,
        question: params.question,
        onAnswerDelta: params.onAnswerDelta
      });
    } else if (step === "market_listings") {
      stepAnswer = await runMarketListingsChatSubAgent({
        toolRunner,
        ctx,
        question: params.question,
        onAnswerDelta: params.onAnswerDelta
      });
    } else if (step === "market_listings_presentation") {
      const rows = composedAnswer ? extractRowsForPresentation(composedAnswer) : [];
      const caps = parseTaskCapabilities(params.question);
      const deck = await runPresentationFromRowsSubAgent({
        toolRunner,
        ctx,
        slideCount: Math.min(14, Math.max(1, caps.slideCount ?? params.slideCount ?? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT)),
        question: params.question,
        title: params.question.trim().slice(0, 120) || "Prezentace realitnich nabidek",
        rows,
        sourceLabel: "market_listings"
      });
      stepAnswer = {
        answer_text: "Vytvořil jsem prezentaci z načtených realitních nabídek.",
        confidence: 0.9,
        sources: [],
        generated_artifacts: [
          { type: "presentation", label: `Prezentace (${deck.totalSlidesLabel} slidu) PPTX`, url: deck.publicUrl },
          { type: "presentation", label: `Prezentace (${deck.totalSlidesLabel} slidu) PDF`, url: deck.pdfPublicUrl }
        ],
        next_actions: ["Otevřete PPTX/PDF a případně upřesněte filtry pro další běh."]
      };
    } else if (step === "analytics_presentation") {
      const rows = composedAnswer ? extractRowsForPresentation(composedAnswer) : [];
      const caps = parseTaskCapabilities(params.question);
      const deck = await runPresentationFromRowsSubAgent({
        toolRunner,
        ctx,
        slideCount: Math.min(14, Math.max(1, caps.slideCount ?? params.slideCount ?? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT)),
        question: params.question,
        title: params.question.trim().slice(0, 120) || "Analyticka prezentace",
        rows,
        sourceLabel: "analytics"
      });
      stepAnswer = {
        answer_text: "Na základě analytických dat jsem vytvořil prezentaci.",
        confidence: 0.9,
        sources: [],
        generated_artifacts: [
          { type: "presentation", label: `Prezentace (${deck.totalSlidesLabel} slidu) PPTX`, url: deck.publicUrl },
          { type: "presentation", label: `Prezentace (${deck.totalSlidesLabel} slidu) PDF`, url: deck.pdfPublicUrl }
        ],
        next_actions: ["Otevřete PPTX/PDF a případně upřesněte metriky."]
      };
    } else if (step === "scheduled_agent_task") {
      stepAnswer = await runScheduledTaskProposalSubAgent({
        toolRunner,
        ctx,
        question: params.question,
        contextText: params.contextText
      });
    } else if (step === "casual_chat") {
      stepAnswer = await runCasualChatSubAgent({ ctx, question: params.question, onAnswerDelta: params.onAnswerDelta });
    } else {
      stepAnswer = await runAnalyticsSubAgent({
        toolRunner,
        ctx,
        question: params.question,
        onAnswerDelta: params.onAnswerDelta
      });
    }

    composedAnswer = composedAnswer ? mergeStepAnswers(composedAnswer, stepAnswer) : stepAnswer;

    // Phase 3: adaptive replan based on actual output of the previous step.
    const replanned = replanRemainingSteps({ remainingSteps: steps, currentAnswer: composedAnswer });
    steps = replanned.steps;
    if (replanned.note) {
      const noteAnswer: AgentAnswer = {
        answer_text: replanned.note,
        confidence: 0.85,
        sources: [],
        generated_artifacts: [],
        next_actions: []
      };
      composedAnswer = mergeStepAnswers(composedAnswer, noteAnswer);
    }
  }

  return (
    composedAnswer ?? {
      answer_text: "",
      confidence: 0,
      sources: [],
      generated_artifacts: [],
      next_actions: []
    }
  );
}

