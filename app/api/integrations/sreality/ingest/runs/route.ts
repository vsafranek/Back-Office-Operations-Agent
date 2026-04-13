import { listIngestionRuns } from "@/lib/integrations/ingestion/ingestion-history";
import { requireOperatorAccess } from "@/lib/security/operator-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireOperatorAccess(request);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const runs = await listIngestionRuns(limit);

    return Response.json({ items: runs, total: runs.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Forbidden") ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
