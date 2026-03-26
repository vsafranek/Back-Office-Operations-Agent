import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

type QueryPreset = "new_clients_q1" | "leads_vs_sales_6m" | "missing_reconstruction";

const PRESET_KEYWORDS: Record<QueryPreset, string[]> = {
  new_clients_q1: ["nov", "klient", "q1", "kvartal"],
  leads_vs_sales_6m: ["lead", "prodan", "6", "mesic"],
  missing_reconstruction: ["chybi", "rekonstruk", "stavebn", "uprav"]
};

function detectPreset(question: string): QueryPreset | null {
  const normalized = question.toLowerCase();
  for (const [preset, keywords] of Object.entries(PRESET_KEYWORDS) as [QueryPreset, string[]][]) {
    if (keywords.every((keyword) => normalized.includes(keyword))) {
      return preset;
    }
  }
  if (normalized.includes("rekonstruk")) {
    return "missing_reconstruction";
  }
  if (normalized.includes("lead") || normalized.includes("prodan")) {
    return "leads_vs_sales_6m";
  }
  if (normalized.includes("klient")) {
    return "new_clients_q1";
  }
  return null;
}

export async function runSqlPreset(params: {
  question: string;
  runId: string;
}): Promise<{ rows: Record<string, unknown>[]; source: string; preset: QueryPreset }> {
  const env = getEnv();
  const supabase = getSupabaseAdminClient();
  const preset = detectPreset(params.question) ?? "new_clients_q1";

  const limit = env.AGENT_MAX_QUERY_ROWS;
  logger.info("sql_preset_start", { runId: params.runId, preset, limit });

  if (preset === "new_clients_q1") {
    const { data, error } = await supabase.from("vw_new_clients_q1").select("*").limit(limit);
    if (error) throw new Error(`vw_new_clients_q1 query failed: ${error.message}`);
    return { rows: data ?? [], source: "vw_new_clients_q1", preset };
  }

  if (preset === "leads_vs_sales_6m") {
    const { data, error } = await supabase.from("vw_leads_vs_sales_6m").select("*").limit(limit);
    if (error) throw new Error(`vw_leads_vs_sales_6m query failed: ${error.message}`);
    return { rows: data ?? [], source: "vw_leads_vs_sales_6m", preset };
  }

  const { data, error } = await supabase.rpc("fn_missing_reconstruction_data");
  if (error) throw new Error(`fn_missing_reconstruction_data failed: ${error.message}`);
  const rows = Array.isArray(data) ? data.slice(0, limit) : [];
  return { rows, source: "fn_missing_reconstruction_data()", preset };
}
