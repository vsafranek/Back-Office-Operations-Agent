import { getEnv } from "@/lib/config/env";
import { purgeOldAgentTraceEvents } from "@/lib/integrations/purge-agent-traces";

export const runtime = "nodejs";

function authorize(request: Request): boolean {
  const env = getEnv();
  if (!env.CRON_SECRET) return true;
  const token = request.headers.get("x-cron-secret");
  return token === env.CRON_SECRET;
}

/**
 * POST /api/cron/purge-audit — smaže agent_trace_events starší než AGENT_TRACE_RETENTION_DAYS (výchozí 90).
 */
export async function POST(request: Request) {
  if (!authorize(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const env = getEnv();
  const retentionDays = env.AGENT_TRACE_RETENTION_DAYS ?? 90;

  try {
    const { deleted } = await purgeOldAgentTraceEvents(retentionDays);
    return Response.json({ ok: true, deleted, retentionDays });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
