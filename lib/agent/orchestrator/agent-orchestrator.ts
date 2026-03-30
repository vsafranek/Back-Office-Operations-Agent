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
  | "calendar_email"
  | "presentation"
  | "weekly_report"
  | "web_search"
  | "market_listings"
  | "market_listings_presentation"
  | "scheduled_agent_task"
  | "casual_chat";

function planSteps(params: {
  intent: AgentIntent;
  question: string;
}): PlannedStep[] {
  const caps = parseTaskCapabilities(params.question);
  if (params.intent === "market_listings") {
    return caps.needsPresentation
      ? ["market_listings", "market_listings_presentation"]
      : ["market_listings"];
  }
  return [params.intent];
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

  const steps = planSteps({ intent: params.intent, question: params.question });
  let composedAnswer: AgentAnswer | null = null;

  for (const step of steps) {
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
      const cards =
        composedAnswer?.dataPanel?.kind === "market_listings"
          ? composedAnswer.dataPanel.listings
          : [];
      if (cards.length === 0) {
        stepAnswer = {
          answer_text: "Prezentaci nelze vytvořit, protože nejsou k dispozici žádné nové nabídky.",
          confidence: 0.7,
          sources: [],
          generated_artifacts: [],
          next_actions: ["Upravte filtry a zkuste načíst více nabídek."]
        };
      } else {
        const caps = parseTaskCapabilities(params.question);
        const deck = await runPresentationFromRowsSubAgent({
          toolRunner,
          ctx,
          slideCount: Math.min(14, Math.max(1, caps.slideCount ?? params.slideCount ?? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT)),
          question: params.question,
          title: params.question.trim().slice(0, 120) || "Prezentace realitnich nabidek",
          rows: cards.map((c) => ({
            title: c.title,
            location: c.location,
            source: c.source,
            url: c.url,
            price_czk: c.price_czk ?? null
          })),
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
      }
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

