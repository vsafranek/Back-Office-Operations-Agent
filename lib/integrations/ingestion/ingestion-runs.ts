import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export type IngestionRunStatus = "running" | "succeeded" | "partial" | "failed";

export type IngestionRunCreateInput = {
  sourceKey: string;
  triggerMode?: "manual" | "scheduled" | "api";
  requestedByUserId?: string | null;
  metadata?: Record<string, unknown>;
};

export type IngestionRunFinalizeInput = {
  status: IngestionRunStatus;
  fetchedCount: number;
  parsedCount: number;
  upsertedCount: number;
  failedCount: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createIngestionRun(input: IngestionRunCreateInput): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("listing_ingestion_runs")
    .insert({
      source_key: input.sourceKey,
      trigger_mode: input.triggerMode ?? "manual",
      requested_by_user_id: input.requestedByUserId ?? null,
      metadata: input.metadata ?? {}
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Unable to create ingestion run: ${error?.message ?? "unknown error"}`);
  }

  return data.id as string;
}

export async function finalizeIngestionRun(runId: string, input: IngestionRunFinalizeInput): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("listing_ingestion_runs")
    .update({
      status: input.status,
      fetched_count: input.fetchedCount,
      parsed_count: input.parsedCount,
      upserted_count: input.upsertedCount,
      failed_count: input.failedCount,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {},
      finished_at: new Date().toISOString()
    })
    .eq("id", runId);

  if (error) {
    throw new Error(`Unable to finalize ingestion run ${runId}: ${error.message}`);
  }
}
