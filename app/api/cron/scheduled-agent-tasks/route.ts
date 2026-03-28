import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { shouldRunScheduledTaskNow } from "@/lib/scheduled-tasks/cron-helpers";
import { runBackOfficeAgent } from "@/lib/agent/index";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

function authorize(request: Request): boolean {
  const env = getEnv();
  if (!env.CRON_SECRET) return true;
  const token = request.headers.get("x-cron-secret");
  return token === env.CRON_SECRET;
}

type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  cron_expression: string;
  timezone: string;
  system_prompt: string;
  user_question: string;
  agent_id: string;
  enabled: boolean;
  last_run_at: string | null;
};

export async function POST(request: Request) {
  if (!authorize(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: tasks, error } = await supabase
    .from("user_scheduled_agent_tasks")
    .select(
      "id, user_id, title, cron_expression, timezone, system_prompt, user_question, agent_id, enabled, last_run_at"
    )
    .eq("enabled", true);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const results: { taskId: string; status: "skipped" | "ok" | "error"; detail?: string }[] = [];

  for (const row of (tasks ?? []) as TaskRow[]) {
    const lastRun = row.last_run_at ? new Date(row.last_run_at) : null;
    if (!shouldRunScheduledTaskNow({ now, cronExpression: row.cron_expression, timezone: row.timezone, lastRunAt: lastRun })) {
      results.push({ taskId: row.id, status: "skipped" });
      continue;
    }

    const prefix =
      "[Plánovaná automatická úloha — řiď se tímto systémovým zadáním. Buď stručný, pokud úloha nevyžaduje jinak.]\n" +
      row.system_prompt;

    try {
      await runBackOfficeAgent({
        userId: row.user_id,
        question: row.user_question || "Splň naplánovanou úlohu podle systémového zadání.",
        agentId: row.agent_id === "thinking-orchestrator" ? "thinking-orchestrator" : "basic",
        orchestratorQuestionPrefix: prefix,
        scheduledTaskExecution: true
      });

      const { error: upErr } = await supabase
        .from("user_scheduled_agent_tasks")
        .update({ last_run_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("id", row.id);

      if (upErr) {
        logger.warn("scheduled_task_last_run_update_failed", { taskId: row.id, message: upErr.message });
      }

      results.push({ taskId: row.id, status: "ok" });
      logger.info("scheduled_agent_task_run_ok", { taskId: row.id, userId: row.user_id, title: row.title });
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown";
      results.push({ taskId: row.id, status: "error", detail: message });
      logger.warn("scheduled_agent_task_run_failed", { taskId: row.id, userId: row.user_id, message });
    }
  }

  return Response.json({
    checkedAt: now.toISOString(),
    count: results.length,
    results
  });
}
