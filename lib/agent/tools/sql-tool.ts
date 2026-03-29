import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";
import {
  type DataPullPlan,
  DataPullPlanSchema,
  inferDataPullPlan,
  narrowRowsByText
} from "@/lib/agent/tools/data-pull-plan";
import { buildClientsTableQuery } from "@/lib/agent/tools/clients-table-query";
import type { ChartKind } from "@/lib/agent/types";

/** Identifikátor zvoleného datového zdroje (pro logy a UI); doplňuje ho plán dotahu, ne soupis presetů. */
export type SqlQueryResultMeta = {
  preset: string;
  rowTextNarrowing?: string;
  filterLabel?: string;
  suggestSourceChannelChart: boolean;
  suggestDerivedCharts: boolean;
  derivedChartKindHint?: ChartKind | null;
};

async function executePlan(plan: DataPullPlan, limit: number) {
  const supabase = getSupabaseAdminClient();
  const narrowing = plan.row_text_narrowing?.trim() || null;
  const fetchCap = narrowing ? Math.min(limit * 4, 800) : limit;

  switch (plan.dataset) {
    case "new_clients_q1": {
      const { data, error } = await supabase.from("vw_new_clients_q1").select("*").limit(fetchCap);
      if (error) throw new Error(`vw_new_clients_q1 query failed: ${error.message}`);
      let rows = data ?? [];
      if (narrowing) rows = narrowRowsByText(rows, narrowing).slice(0, limit);
      else rows = rows.slice(0, limit);
      const source =
        narrowing != null
          ? `vw_new_clients_q1 · text «${narrowing}»`
          : "vw_new_clients_q1";
      return { rows, source };
    }
    case "clients": {
      const { builder, sourceLabel } = buildClientsTableQuery(supabase, {
        freeTextAreaOrNotes: narrowing,
        filters: plan.client_filters ?? null,
        limit
      });
      const { data, error } = await builder;
      if (error) throw new Error(`clients query failed: ${error.message}`);
      return { rows: data ?? [], source: sourceLabel };
    }
    case "leads_vs_sales_6m": {
      const { data, error } = await supabase.from("vw_leads_vs_sales_6m").select("*").limit(limit);
      if (error) throw new Error(`vw_leads_vs_sales_6m query failed: ${error.message}`);
      let rows = data ?? [];
      if (narrowing) {
        logger.warn("sql_leads_vs_sales_6m_narrowing_ignored", { term: narrowing });
      }
      rows = rows.slice(0, limit);
      return { rows, source: "vw_leads_vs_sales_6m" };
    }
    case "deal_sales_detail": {
      let { data, error } = await supabase
        .from("vw_deal_sales_detail")
        .select("*")
        .order("sold_at", { ascending: false, nullsFirst: false })
        .limit(fetchCap);
      if (error) throw new Error(`vw_deal_sales_detail query failed: ${error.message}`);
      let rows = data ?? [];
      if (narrowing) rows = narrowRowsByText(rows, narrowing).slice(0, limit);
      else rows = rows.slice(0, limit);
      const source =
        narrowing != null ? `vw_deal_sales_detail · text «${narrowing}»` : "vw_deal_sales_detail";
      return { rows, source };
    }
    case "missing_reconstruction": {
      const { data, error } = await supabase.rpc("fn_missing_reconstruction_data");
      if (error) throw new Error(`fn_missing_reconstruction_data failed: ${error.message}`);
      let rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      if (narrowing) rows = narrowRowsByText(rows, narrowing).slice(0, limit);
      else rows = rows.slice(0, limit);
      const source =
        narrowing != null
          ? `fn_missing_reconstruction_data() · text «${narrowing}»`
          : "fn_missing_reconstruction_data()";
      return { rows, source };
    }
    default: {
      const _: never = plan.dataset;
      throw new Error(`Neznamy dataset: ${String(_)}`);
    }
  }
}

/** Bez LLM — jen allowlistovaný plán (např. HTTP API z UI). */
export async function runDataPullPlanDirect(
  planInput: unknown,
  limitOverride?: number
): Promise<{
  rows: Record<string, unknown>[];
  source: string;
  preset: string;
  suggestSourceChannelChart: boolean;
  suggestDerivedCharts: boolean;
  derivedChartKindHint?: ChartKind | null;
  filterLabel?: string;
}> {
  const plan = DataPullPlanSchema.parse(planInput);
  const env = getEnv();
  const cap = Math.min(Math.max(limitOverride ?? env.AGENT_MAX_QUERY_ROWS, 1), 200);
  const { rows, source } = await executePlan(plan, cap);
  return {
    rows,
    source,
    preset: plan.dataset,
    suggestSourceChannelChart: plan.suggest_source_channel_chart ?? false,
    suggestDerivedCharts: plan.suggest_derived_charts ?? false,
    derivedChartKindHint: plan.derived_chart_kind_hint ?? null,
    filterLabel: plan.filter_label ?? undefined
  };
}

export async function runSqlPreset(params: {
  question: string;
  runId: string;
  trace?: AgentTraceRecorder;
  traceParentId?: string | null;
}): Promise<{
  rows: Record<string, unknown>[];
  source: string /** Popis provedeného dotahu (view / RPC + případný textový filtr). */;
} & SqlQueryResultMeta> {
  const env = getEnv();
  const limit = env.AGENT_MAX_QUERY_ROWS;

  const plan = await inferDataPullPlan({
    question: params.question,
    runId: params.runId,
    trace:
      params.trace != null
        ? { recorder: params.trace, parentId: params.traceParentId ?? null }
        : undefined
  });

  logger.info("sql_data_pull_start", {
    runId: params.runId,
    dataset: plan.dataset,
    hasNarrowing: Boolean(plan.row_text_narrowing),
    clientFilterCount: plan.client_filters?.length ?? 0,
    chart: plan.suggest_source_channel_chart,
    derivedCharts: plan.suggest_derived_charts,
    limit
  });

  const { rows, source } = await executePlan(plan, limit);

  return {
    rows,
    source,
    preset: plan.dataset,
    rowTextNarrowing: plan.row_text_narrowing ?? undefined,
    filterLabel: plan.filter_label ?? undefined,
    suggestSourceChannelChart: plan.suggest_source_channel_chart ?? false,
    suggestDerivedCharts: plan.suggest_derived_charts ?? false,
    derivedChartKindHint: plan.derived_chart_kind_hint ?? null
  };
}
