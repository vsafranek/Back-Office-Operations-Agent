import { WEEKLY_REPORT_DEFAULT_SLIDE_COUNT } from "@/lib/agent/defaults";
import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
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
}): Promise<AgentAnswer> {
  const toolRunner = getToolRunner();

  if (params.intent === "calendar_email") {
    return runCalendarEmailSubAgent({
      toolRunner,
      ctx: params.ctx,
      question: params.question,
      contextText: params.contextText
    });
  }

  if (params.intent === "weekly_report") {
    const slideCount = params.slideCount ?? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT;
    const title = params.question.trim().slice(0, 120) || "Prezentacni report";
    return runWeeklyReportSubAgent({
      toolRunner,
      ctx: params.ctx,
      slideCount,
      question: params.question,
      title
    });
  }

  if (params.intent === "web_search") {
    return runWebSearchSubAgent({ toolRunner, ctx: params.ctx, question: params.question });
  }

  return runAnalyticsSubAgent({
    toolRunner,
    ctx: params.ctx,
    question: params.question
  });
}

