import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import type {
  AgentRunRow,
  AuditRunAggregate,
  OutboundEmailEventRow,
  OutboundWithLeads
} from "@/lib/types/audit-run-aggregate";

export type { AgentRunRow, AuditRunAggregate, OutboundEmailEventRow, OutboundWithLeads };

/**
 * Agregát auditu pro jeden běh agenta (vlastník userId — kontrola v API).
 */
export async function fetchAuditRunAggregate(params: {
  runId: string;
  userId: string;
}): Promise<AuditRunAggregate> {
  const supabase = getSupabaseAdminClient();
  const { runId, userId } = params;

  const { data: runRow } = await supabase
    .from("agent_runs")
    .select("run_id, user_id, question, intent, answer, confidence, sources, created_at, finished_at")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .maybeSingle();

  const { count: traceEventCount } = await supabase
    .from("agent_trace_events")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("user_id", userId);

  const { data: traceSample } = await supabase
    .from("agent_trace_events")
    .select("id, kind, name, status, duration_ms, created_at")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .order("step_index", { ascending: true })
    .limit(25);

  const { data: outboundRows } = await supabase
    .from("outbound_email_events")
    .select(
      "id, action, to_email, subject, body_excerpt, gmail_draft_id, gmail_message_id, conversation_id, agent_run_id, created_at, meta"
    )
    .eq("user_id", userId)
    .eq("agent_run_id", runId)
    .order("created_at", { ascending: true });

  const outboundList = (outboundRows ?? []) as OutboundEmailEventRow[];
  const eventIds = outboundList.map((r) => r.id);
  let leadByEvent = new Map<string, string[]>();
  if (eventIds.length > 0) {
    const { data: links } = await supabase
      .from("outbound_email_event_leads")
      .select("outbound_email_event_id, lead_id")
      .in("outbound_email_event_id", eventIds);
    for (const row of links ?? []) {
      const eid = row.outbound_email_event_id as string;
      const lid = row.lead_id as string;
      const arr = leadByEvent.get(eid) ?? [];
      arr.push(lid);
      leadByEvent.set(eid, arr);
    }
  }

  const outboundEmails: OutboundWithLeads[] = outboundList.map((r) => ({
    ...r,
    meta: (r.meta ?? {}) as Record<string, unknown>,
    leadIds: leadByEvent.get(r.id) ?? []
  }));

  return {
    runId,
    agentRun: (runRow as AgentRunRow | null) ?? null,
    traceEventCount: traceEventCount ?? 0,
    traceSample: (traceSample ?? []) as AuditRunAggregate["traceSample"],
    outboundEmails
  };
}

export function auditRunAggregateToCsv(agg: AuditRunAggregate): string {
  const lines: string[] = ["section,field,value"];
  lines.push(`agent_run,run_id,${escapeCsv(agg.runId)}`);
  if (agg.agentRun) {
    lines.push(`agent_run,intent,${escapeCsv(agg.agentRun.intent)}`);
    lines.push(`agent_run,question,${escapeCsv(agg.agentRun.question.slice(0, 500))}`);
    lines.push(`agent_run,confidence,${agg.agentRun.confidence}`);
    lines.push(`agent_run,created_at,${escapeCsv(agg.agentRun.created_at)}`);
  }
  lines.push(`trace,event_count,${agg.traceEventCount}`);
  for (const ev of agg.outboundEmails) {
    lines.push(
      `outbound,${escapeCsv(ev.id)},${escapeCsv(ev.action)}|${escapeCsv(ev.to_email)}|${escapeCsv(ev.subject)}|leads:${ev.leadIds.join(";")}`
    );
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
