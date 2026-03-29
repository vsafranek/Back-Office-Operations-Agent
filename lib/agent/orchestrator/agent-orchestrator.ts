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

export type AgentIntent =
  | "analytics"
  | "calendar_email"
  | "presentation"
  | "weekly_report"
  | "web_search"
  | "market_listings"
  | "scheduled_agent_task"
  | "casual_chat";

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

  if (params.intent === "calendar_email") {
    return runCalendarEmailSubAgent({
      toolRunner,
      ctx,
      question: params.question,
      contextText: params.contextText,
      onAnswerDelta: params.onAnswerDelta
    });
  }

  if (params.intent === "presentation") {
    const slideCount = Math.min(14, Math.max(1, params.slideCount ?? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT));
    const title = params.question.trim().slice(0, 120) || "Prezentace";
    return runPresentationSubAgent({
      toolRunner,
      ctx,
      slideCount,
      question: params.question,
      title,
      onAnswerDelta: params.onAnswerDelta
    });
  }

  if (params.intent === "weekly_report") {
    const slideCount = Math.min(14, Math.max(1, params.slideCount ?? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT));
    const title = params.question.trim().slice(0, 120) || "Prezentacni report";
    return runWeeklyReportSubAgent({
      toolRunner,
      ctx,
      slideCount,
      question: params.question,
      title,
      onAnswerDelta: params.onAnswerDelta
    });
  }

  if (params.intent === "web_search") {
    return runWebSearchSubAgent({
      toolRunner,
      ctx,
      question: params.question,
      onAnswerDelta: params.onAnswerDelta
    });
  }

  if (params.intent === "market_listings") {
    return runMarketListingsChatSubAgent({
      toolRunner,
      ctx,
      question: params.question,
      onAnswerDelta: params.onAnswerDelta
    });
  }

  if (params.intent === "scheduled_agent_task") {
    return runScheduledTaskProposalSubAgent({ toolRunner, ctx, question: params.question, contextText: params.contextText });
  }

  if (params.intent === "casual_chat") {
    return runCasualChatSubAgent({ ctx, question: params.question, onAnswerDelta: params.onAnswerDelta });
  }

  return runAnalyticsSubAgent({
    toolRunner,
    ctx,
    question: params.question,
    onAnswerDelta: params.onAnswerDelta
  });
}

