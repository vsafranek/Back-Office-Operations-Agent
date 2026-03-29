import { WEEKLY_REPORT_DEFAULT_SLIDE_COUNT } from "@/lib/agent/defaults";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { getToolRunner } from "@/lib/agent/mcp-tools/tool-registry";
import { runWeeklyReportSubAgent } from "@/lib/agent/subagents/weekly-report-subagent";

export async function runWeeklyExecutiveReport(options?: { slideCount?: number; title?: string; context?: string }) {
  const runId = `weekly-${Date.now()}`;
  const supabase = getSupabaseAdminClient();
  const resolvedSlideCount = Math.min(14, Math.max(1, options?.slideCount ?? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT));
  const deckTitle = options?.title?.trim() || "Tydenni executive report";
  const deckContext = options?.context?.trim() || "Tydenni update pro management realitnich operaci.";
  await supabase.from("workflow_runs").insert({
    workflow_name: "weekly_exec_report",
    run_ref: runId,
    status: "started",
    triggered_by: "cron",
    actor_user_id: "automation_worker"
  });

  const toolRunner = getToolRunner();
  const automationCtx = { runId, userId: "automation_worker" };

  try {
    const answer = await runWeeklyReportSubAgent({
      toolRunner,
      ctx: automationCtx,
      slideCount: resolvedSlideCount,
      question: deckContext,
      title: deckTitle
    });

    const source = answer.sources[0] ?? "unknown_source";

    const csvPublic = answer.generated_artifacts.find((a) => a.type === "report" && a.label === "CSV dataset")?.url;
    const mdPublic = answer.generated_artifacts.find((a) => a.type === "report" && a.label === "Markdown summary")?.url;
    const presentationPublic = answer.generated_artifacts.find(
      (a) => a.type === "presentation" && a.label.includes("PPTX")
    )?.url;
    const presentationPdfPublic = answer.generated_artifacts.find(
      (a) => a.type === "presentation" && a.label.includes("PDF")
    )?.url;

    logger.info("weekly_exec_report_finished", { runId, source });
    await supabase
      .from("workflow_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        metadata: {
          source,
          slideCount: resolvedSlideCount,
          artifacts: { csvPublic, mdPublic, presentationPublic, presentationPdfPublic }
        }
      })
      .eq("run_ref", runId);

    return {
      runId,
      source,
      artifacts: {
        csvPublic,
        mdPublic,
        presentationPublic,
        presentationPdfPublic
      }
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 4000) : String(e);
    logger.error("weekly_exec_report_failed", { runId, message: msg });
    await supabase
      .from("workflow_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: msg
      })
      .eq("run_ref", runId);
    throw e;
  }
}
