import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import { getToolRunner } from "@/lib/agent/mcp-tools/tool-registry";
import { runAnalyticsSubAgent } from "@/lib/agent/subagents/analytics-subagent";
import { runCalendarEmailSubAgent } from "@/lib/agent/subagents/calendar-email-subagent";
import { runWeeklyReportSubAgent } from "@/lib/agent/subagents/weekly-report-subagent";

export type AgentIntent = "analytics" | "calendar_email" | "weekly_report";

export async function runAgentOrchestrator(params: {
  intent: AgentIntent;
  ctx: AgentToolContext;
  question: string;
  contextText: string;
  slideCount?: number;
}): Promise<AgentAnswer> {
  const toolRunner = getToolRunner();

  if (params.intent === "calendar_email") {
    return runCalendarEmailSubAgent({ toolRunner, ctx: params.ctx, contextText: params.contextText });
  }

  if (params.intent === "weekly_report") {
    const slideCount = params.slideCount ?? 5;
    return runWeeklyReportSubAgent({
      toolRunner,
      ctx: params.ctx,
      slideCount,
      question: params.question
    });
  }

  return runAnalyticsSubAgent({
    toolRunner,
    ctx: params.ctx,
    question: params.question
  });
}

