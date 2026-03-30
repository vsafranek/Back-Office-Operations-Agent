import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { runScheduledAgentTasksCycle } from "@/lib/scheduled-tasks/run-scheduled-agent-tasks";

export const runtime = "nodejs";

/** Ruční spuštění jedné naplánované úlohy (jen vlastní, musí být zapnutá). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { id: taskId } = await ctx.params;

    const supabase = getSupabaseAdminClient();
    const { data: row, error: fetchErr } = await supabase
      .from("user_scheduled_agent_tasks")
      .select("id, enabled")
      .eq("id", taskId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr) {
      return Response.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!row) {
      return Response.json({ error: "Úloha nenalezena." }, { status: 404 });
    }
    if (!row.enabled) {
      return Response.json({ error: "Úloha je vypnutá — zapněte ji nebo ji nejdřív uložte jako zapnutou." }, { status: 400 });
    }

    const out = await runScheduledAgentTasksCycle({
      respectTimeWindow: false,
      filterUserId: user.id,
      filterTaskId: taskId,
      updateLastRunAtAfterSuccess: false
    });

    if (out.loadError) {
      return Response.json({ error: out.loadError }, { status: 500 });
    }

    return Response.json({
      checkedAt: out.checkedAt,
      count: out.count,
      results: out.results
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
