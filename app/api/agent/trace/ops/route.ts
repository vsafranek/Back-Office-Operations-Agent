import type { AgentTraceEventRow } from "@/lib/agent/trace/types";
import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

const ALLOWED_TRACE_OWNERS = new Set(["automation_worker"]);

/**
 * GET /api/agent/trace/ops?runId=...&traceUserId=automation_worker
 * Čtení trace pro systémové actory (cron) — pouze s hlavičkou X-Audit-Ops-Secret.
 * Bezpečnější než otevřít trace všem; vhodné pro operátory / interní nástroje.
 */
export async function GET(request: Request) {
  const env = getEnv();
  const secret = env.AUDIT_OPS_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: "AUDIT_OPS_SECRET is not configured." }, { status: 503 });
  }

  const hdr = request.headers.get("x-audit-ops-secret");
  if (hdr !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const runId = url.searchParams.get("runId")?.trim();
  const traceUserId = url.searchParams.get("traceUserId")?.trim();
  if (!runId) {
    return Response.json({ error: "Missing runId." }, { status: 400 });
  }
  if (!traceUserId || !ALLOWED_TRACE_OWNERS.has(traceUserId)) {
    return Response.json(
      { error: "Invalid or missing traceUserId (allowed: automation_worker)." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("agent_trace_events")
    .select("*")
    .eq("run_id", runId)
    .eq("user_id", traceUserId)
    .order("step_index", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ events: (data ?? []) as AgentTraceEventRow[] });
}
