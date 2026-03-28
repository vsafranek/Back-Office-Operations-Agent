import { auditRunAggregateToCsv, fetchAuditRunAggregate } from "@/lib/integrations/audit-run-aggregate";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

/**
 * GET /api/audit/run?runId=...&format=json|csv
 * Agregát: agent_runs + počet/sample trace + outbound e-maily a leady pro daný run (vlastník = Bearer).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const url = new URL(request.url);
    const runId = url.searchParams.get("runId")?.trim();
    const format = url.searchParams.get("format")?.trim().toLowerCase() ?? "json";
    if (!runId) {
      return Response.json({ error: "Missing runId." }, { status: 400 });
    }

    const aggregate = await fetchAuditRunAggregate({ runId, userId: user.id });

    if (format === "csv") {
      const csv = auditRunAggregateToCsv(aggregate);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-run-${runId.slice(0, 8)}.csv"`
        }
      });
    }

    return Response.json(aggregate);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer")
        ? 401
        : 500;
    return Response.json({ error: message }, { status });
  }
}
