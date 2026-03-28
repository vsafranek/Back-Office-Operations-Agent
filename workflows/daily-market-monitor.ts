import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { getToolRunner } from "@/lib/agent/mcp-tools/tool-registry";
import { runDailyMarketMonitorSubAgent } from "@/lib/agent/subagents/daily-market-monitor-subagent";

export async function runDailyMarketMonitor() {
  const runRef = `daily-${Date.now()}`;
  const supabase = getSupabaseAdminClient();
  await supabase.from("workflow_runs").insert({
    workflow_name: "daily_market_monitor",
    run_ref: runRef,
    status: "started",
    triggered_by: "cron",
    actor_user_id: "automation_worker"
  });

  const toolRunner = getToolRunner();
  const automationCtx = { runId: runRef, userId: "automation_worker" };

  try {
    const metrics = await runDailyMarketMonitorSubAgent({
      toolRunner,
      ctx: automationCtx,
      location: "Praha Holešovice"
    });

    logger.info("daily_market_monitor_finished", { inserted: metrics.upserted, failed: metrics.failed });
    await supabase
      .from("workflow_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        metadata: {
          inserted: metrics.upserted,
          failed: metrics.failed,
          listingsCount: metrics.listingsCount
        }
      })
      .eq("run_ref", runRef);

    return { inserted: metrics.upserted, failed: metrics.failed, listingsCount: metrics.listingsCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 4000) : String(e);
    logger.error("daily_market_monitor_failed", { runRef, message: msg });
    await supabase
      .from("workflow_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: msg
      })
      .eq("run_ref", runRef);
    throw e;
  }
}
