import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export type IngestionRunListItem = {
  id: string;
  sourceKey: string;
  triggerMode: string;
  status: string;
  requestedByUserId: string | null;
  startedAt: string;
  finishedAt: string | null;
  fetchedCount: number;
  parsedCount: number;
  upsertedCount: number;
  failedCount: number;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
};

export async function listIngestionRuns(limit = 50): Promise<IngestionRunListItem[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("listing_ingestion_runs")
    .select(
      "id,source_key,trigger_mode,status,requested_by_user_id,started_at,finished_at,fetched_count,parsed_count,upserted_count,failed_count,error_message,metadata"
    )
    .order("started_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (error) {
    throw new Error(`Unable to list ingestion runs: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    sourceKey: row.source_key as string,
    triggerMode: row.trigger_mode as string,
    status: row.status as string,
    requestedByUserId: (row.requested_by_user_id as string | null) ?? null,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
    fetchedCount: Number(row.fetched_count ?? 0),
    parsedCount: Number(row.parsed_count ?? 0),
    upsertedCount: Number(row.upserted_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    errorMessage: (row.error_message as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null
  }));
}
