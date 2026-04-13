import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { runSrealityIngestion } from "@/lib/integrations/ingestion/run-ingestion";

export const runtime = "nodejs";

const IngestRequestSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(60),
  localityRegionId: z.coerce.number().int().optional(),
  localityDistrictId: z.coerce.number().int().optional(),
  offerKind: z.enum(["prodej", "pronajem"]).default("prodej"),
  categoryMain: z.union([z.literal(1), z.literal(2)]).optional(),
  categorySubCb: z.coerce.number().int().optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const parsed = IngestRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Neplatné parametry ingestion požadavku.",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const result = await runSrealityIngestion({
      page: data.page,
      perPage: data.perPage,
      requestedByUserId: user.id,
      triggerMode: "api",
      sourceOptions: {
        categoryMain: data.categoryMain,
        categoryType: data.offerKind === "pronajem" ? 2 : 1,
        localityRegionId: data.localityRegionId,
        localityDistrictId: data.localityDistrictId,
        categorySubCb: data.categorySubCb
      }
    });

    return Response.json({
      ok: true,
      source: "sreality",
      runId: result.runId,
      summary: {
        fetched: result.fetchedCount,
        parsed: result.parsedCount,
        upserted: result.upsertedCount,
        failed: result.failedCount
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer") ? 401 : 500;

    return Response.json({ error: message }, { status });
  }
}
