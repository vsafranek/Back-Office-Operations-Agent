import { runSqlPreset } from "@/lib/agent/tools/sql-tool";
import { generateReportArtifacts } from "@/lib/agent/tools/report-tool";
import { generatePresentationArtifact } from "@/lib/agent/tools/presentation-tool";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export async function runWeeklyExecutiveReport(options?: { slideCount?: number; title?: string; context?: string }) {
  const runId = `weekly-${Date.now()}`;
  const supabase = getSupabaseAdminClient();
  const resolvedSlideCount = Math.min(15, Math.max(2, options?.slideCount ?? 5));
  const deckTitle = options?.title?.trim() || "Tydenni executive report";
  const deckContext = options?.context?.trim() || "Tydenni update pro management realitnich operaci.";
  await supabase.from("workflow_runs").insert({
    workflow_name: "weekly_exec_report",
    run_ref: runId,
    status: "started"
  });

  const query = await runSqlPreset({
    runId,
    question: "Vytvor graf vyvoje poctu leadu a prodanych nemovitosti za poslednich 6 mesicu."
  });

  const artifacts = await generateReportArtifacts({
    runId,
    title: deckTitle,
    rows: query.rows
  });
  const presentation = await generatePresentationArtifact({
    runId,
    title: deckTitle,
    rows: query.rows,
    context: deckContext,
    slideCount: resolvedSlideCount
  });

  logger.info("weekly_exec_report_finished", { runId, source: query.source });
  await supabase
    .from("workflow_runs")
    .update({ status: "completed", finished_at: new Date().toISOString() })
    .eq("run_ref", runId);

  return {
    runId,
    source: query.source,
    artifacts: {
      ...artifacts,
      presentationPublic: presentation.publicUrl,
      presentationPdfPublic: presentation.pdfPublicUrl
    }
  };
}
