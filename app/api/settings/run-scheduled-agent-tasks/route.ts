import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { runScheduledAgentTasksCycle } from "@/lib/scheduled-tasks/run-scheduled-agent-tasks";

export const runtime = "nodejs";

/** Ruční spuštění naplánovaných úloh přihlášeného uživatele (bez časového okna kolem cronu). */
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const out = await runScheduledAgentTasksCycle({
      respectTimeWindow: false,
      filterUserId: user.id,
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
