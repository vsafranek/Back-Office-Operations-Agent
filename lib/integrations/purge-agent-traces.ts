import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { logger } from "@/lib/observability/logger";

/**
 * Smaže staré řádky z agent_trace_events (BOA-007 retence).
 * Pozor: u velkých objemů zvažte batched delete nebo pg_cron přímo v DB.
 */
export async function purgeOldAgentTraceEvents(retentionDays: number): Promise<{ deleted: number }> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const cutoffIso = cutoff.toISOString();

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("agent_trace_events")
    .delete()
    .lt("created_at", cutoffIso)
    .select("id");

  if (error) {
    logger.warn("purge_agent_traces_failed", { message: error.message });
    throw new Error(error.message);
  }

  const deleted = data?.length ?? 0;
  logger.info("purge_agent_traces_done", { deleted, retentionDays, cutoffIso });
  return { deleted };
}
