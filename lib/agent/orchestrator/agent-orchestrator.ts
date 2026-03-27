import { WEEKLY_REPORT_DEFAULT_SLIDE_COUNT } from "@/lib/agent/defaults";
import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";
import { getToolRunner } from "@/lib/agent/mcp-tools/tool-registry";
import { runAnalyticsSubAgent } from "@/lib/agent/subagents/analytics-subagent";
import { runCalendarEmailSubAgent } from "@/lib/agent/subagents/calendar-email-subagent";
import { runWeeklyReportSubAgent } from "@/lib/agent/subagents/weekly-report-subagent";
import { runWebSearchSubAgent } from "@/lib/agent/subagents/web-search-subagent";

export type AgentIntent = "analytics" | "calendar_email" | "weekly_report" | "web_search";

export async function runAgentOrchestrator(params: {
  intent: AgentIntent;
  ctx: AgentToolContext;
  question: string;
  contextText: string;
  slideCount?: number;
  trace?: AgentTraceRecorder;
  traceDispatchId?: string | null;
}): Promise<AgentAnswer> {
  const toolRunner = getToolRunner();

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
      contextText: params.contextText
    });
  }

  if (params.intent === "weekly_report") {
    const slideCount = params.slideCount ?? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT;
    const title = params.question.trim().slice(0, 120) || "Prezentacni report";
    return runWeeklyReportSubAgent({
      toolRunner,
      ctx,
      slideCount,
      question: params.question,
      title
    });
  }

  if (params.intent === "web_search") {
    return runWebSearchSubAgent({ toolRunner, ctx, question: params.question });
  }

  return runAnalyticsSubAgent({
    toolRunner,
    ctx,
    question: params.question
  });
}

