import { DataPullPlanSchema, type DataPullPlan } from "@/lib/agent/tools/data-pull-plan";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

/**
 * Načte uložený preset uživatele a vrátí validovaný plán dotahu (bez volného SQL).
 */
export async function loadUserDataBrowserPresetPlan(userId: string, presetId: string): Promise<DataPullPlan> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_data_browser_presets")
    .select(
      "base_dataset, row_text_narrowing, client_filters, filter_label, suggest_source_channel_chart, suggest_derived_charts, derived_chart_kind_hint"
    )
    .eq("id", presetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Preset: ${error.message}`);
  if (!data) throw new Error("Uložený preset nenalezen.");

  const narrowing = data.row_text_narrowing?.trim() || null;
  return DataPullPlanSchema.parse({
    dataset: data.base_dataset,
    row_text_narrowing: narrowing,
    client_filters: data.client_filters ?? null,
    filter_label: data.filter_label?.trim() || null,
    suggest_source_channel_chart: data.suggest_source_channel_chart ?? false,
    suggest_derived_charts: data.suggest_derived_charts ?? false,
    derived_chart_kind_hint: data.derived_chart_kind_hint ?? null
  });
}
