import { runDailyMarketMonitor } from "@/workflows/daily-market-monitor";
import { getEnv } from "@/lib/config/env";

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

  const result = await runDailyMarketMonitor();
  return Response.json(result);
}
