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

function embeddedRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v === "object" && v !== null && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

/** Zploštění FK z PostgREST — v UI místo holých UUID klient / nemovitost / lead. */
function flattenDealRow(row: Record<string, unknown>): Record<string, unknown> {
  const clients = embeddedRecord(row.clients);
  const properties = embeddedRecord(row.properties);
  const leadEmb = embeddedRecord(row.leads);
  const { clients: _c, properties: _p, leads: _l, ...rest } = row;
  return {
    ...rest,
    client_full_name: typeof clients?.full_name === "string" ? clients.full_name : null,
    client_email: typeof clients?.email === "string" ? clients.email : null,
    client_phone: typeof clients?.phone === "string" ? clients.phone : null,
    property_title: typeof properties?.title === "string" ? properties.title : null,
    property_internal_ref: typeof properties?.internal_ref === "string" ? properties.internal_ref : null,
    property_kind_label: typeof properties?.property_kind === "string" ? properties.property_kind : null,
    property_listed_price: properties?.listed_price ?? null,
    lead_status: typeof leadEmb?.status === "string" ? leadEmb.status : null,
    lead_expected_value_czk: leadEmb?.expected_value_czk ?? null,
    lead_source_channel: typeof leadEmb?.source_channel === "string" ? leadEmb.source_channel : null,
    lead_notes: typeof leadEmb?.notes === "string" ? leadEmb.notes : null
  };
}

function flattenLeadRow(row: Record<string, unknown>): Record<string, unknown> {
  const clients = embeddedRecord(row.clients);
  const properties = embeddedRecord(row.properties);
  const { clients: _c, properties: _p, ...rest } = row;
  return {
    ...rest,
    client_full_name: typeof clients?.full_name === "string" ? clients.full_name : null,
    client_email: typeof clients?.email === "string" ? clients.email : null,
    client_phone: typeof clients?.phone === "string" ? clients.phone : null,
    property_title: typeof properties?.title === "string" ? properties.title : null,
    property_internal_ref: typeof properties?.internal_ref === "string" ? properties.internal_ref : null,
    property_kind_label: typeof properties?.property_kind === "string" ? properties.property_kind : null,
    property_listed_price: properties?.listed_price ?? null
  };
}

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
    case "properties": {
      let { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(fetchCap);
      if (error) throw new Error(`properties query failed: ${error.message}`);
      let rows = (data ?? []) as Record<string, unknown>[];
      if (narrowing) rows = narrowRowsByText(rows, narrowing).slice(0, limit);
      else rows = rows.slice(0, limit);
      const sourceLabel =
        narrowing != null ? `public.properties · text «${narrowing}»` : "public.properties";
      return { rows, source: sourceLabel };
    }
    case "deals": {
      let { data, error } = await supabase
        .from("deals")
        .select(
          `
          id,
          property_id,
          client_id,
          lead_id,
          sold_price,
          sold_at,
          created_at,
          status,
          commission_czk,
          commission_rate_pct,
          deal_source,
          clients ( full_name, email, phone ),
          properties ( title, internal_ref, property_kind, listed_price ),
          leads ( status, expected_value_czk, source_channel, notes )
        `
        )
        .order("sold_at", { ascending: false, nullsFirst: false })
        .limit(fetchCap);
      if (error) throw new Error(`deals query failed: ${error.message}`);
      let rows = (data ?? []).map((r) => flattenDealRow(r as Record<string, unknown>));
      if (narrowing) rows = narrowRowsByText(rows, narrowing).slice(0, limit);
      else rows = rows.slice(0, limit);
      const sourceLabel = narrowing != null ? `public.deals · text «${narrowing}»` : "public.deals";
      return { rows, source: sourceLabel };
    }
    case "leads": {
      let { data, error } = await supabase
        .from("leads")
        .select(
          `
          id,
          client_id,
          property_id,
          status,
          source_channel,
          created_at,
          updated_at,
          last_contact_at,
          expected_value_czk,
          lost_reason,
          notes,
          clients ( full_name, email, phone ),
          properties ( title, internal_ref, property_kind, listed_price )
        `
        )
        .order("created_at", { ascending: false })
        .limit(fetchCap);
      if (error) throw new Error(`leads query failed: ${error.message}`);
      let rows = (data ?? []).map((r) => flattenLeadRow(r as Record<string, unknown>));
      if (narrowing) rows = narrowRowsByText(rows, narrowing).slice(0, limit);
      else rows = rows.slice(0, limit);
      const sourceLabel = narrowing != null ? `public.leads · text «${narrowing}»` : "public.leads";
      return { rows, source: sourceLabel };
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
    case "lead_pipeline_summary": {
      const { data, error } = await supabase.from("vw_lead_pipeline_summary").select("*").limit(fetchCap);
      if (error) throw new Error(`vw_lead_pipeline_summary query failed: ${error.message}`);
      let rows = data ?? [];
      if (narrowing) rows = narrowRowsByText(rows, narrowing).slice(0, limit);
      else rows = rows.slice(0, limit);
      const sourceLabel =
        narrowing != null ? `vw_lead_pipeline_summary · text «${narrowing}»` : "vw_lead_pipeline_summary";
      return { rows, source: sourceLabel };
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
