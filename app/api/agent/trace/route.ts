import type { AgentTraceEventRow } from "@/lib/agent/trace/types";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

export type { AgentTraceEventRow };

/**
 * GET /api/agent/trace?runId=...
 * Vrací plochý seznam událostí; klient skládá strom přes parent_id.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const url = new URL(request.url);
    const runId = url.searchParams.get("runId")?.trim();
    if (!runId) {
      return Response.json({ error: "Missing runId." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("agent_trace_events")
      .select("*")
      .eq("run_id", runId)
      .eq("user_id", user.id)
      .order("step_index", { ascending: true });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ events: (data ?? []) as AgentTraceEventRow[] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 400 });
  }
}
