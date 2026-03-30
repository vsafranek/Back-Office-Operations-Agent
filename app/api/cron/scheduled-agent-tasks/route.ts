import { getEnv } from "@/lib/config/env";
import { runScheduledAgentTasksCycle } from "@/lib/scheduled-tasks/run-scheduled-agent-tasks";

export const runtime = "nodejs";

function authorize(request: Request): boolean {
  const env = getEnv();
  if (!env.CRON_SECRET) return true;
  const token = request.headers.get("x-cron-secret");
  return token === env.CRON_SECRET;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const out = await runScheduledAgentTasksCycle({
    respectTimeWindow: true,
    updateLastRunAtAfterSuccess: true
  });
  if (out.loadError) {
    return Response.json({ error: out.loadError }, { status: 500 });
  }

  return Response.json({
    checkedAt: out.checkedAt,
    count: out.count,
    results: out.results
  });
}
