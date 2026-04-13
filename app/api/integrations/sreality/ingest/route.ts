import { z } from "zod";

import { runSrealityIngestion } from "@/lib/integrations/ingestion/run-ingestion";
import { logger } from "@/lib/observability/logger";
import { requireOperatorAccess } from "@/lib/security/operator-auth";

export const runtime = "nodejs";

const IngestRequestSchema = z.object({
  mode: z.enum(["apartments_full", "apartments_chunk"]).default("apartments_full"),
  dryRun: z.boolean().default(false),
  perPage: z.coerce.number().int().min(1).max(60).default(60),
  maxPages: z.coerce.number().int().min(1).max(500).optional(),
  pageStart: z.coerce.number().int().min(1).default(1),
  chunkPages: z.coerce.number().int().min(1).max(500).optional(),
  offerKind: z.enum(["prodej", "pronajem"]).default("prodej")
});

export async function POST(request: Request) {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();

  try {
    const operator = await requireOperatorAccess(request);
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
    const fullScan = data.mode === "apartments_full" || data.mode === "apartments_chunk";
    const maxPages = data.mode === "apartments_chunk" ? data.chunkPages ?? data.maxPages ?? 1 : data.maxPages;

    const result = await runSrealityIngestion({
      page: data.pageStart,
      perPage: data.perPage,
      fullScan,
      dryRun: data.dryRun,
      requestedByUserId: operator.id === "operator-key" ? null : operator.id,
      triggerMode: "api",
      sourceOptions: {
        categoryMain: 1,
        categoryType: data.offerKind === "pronajem" ? 2 : 1,
        categorySubCb: 2,
        fullScan,
        maxPages
      }
    });

    logger.info("sreality_ingest_triggered", {
      correlationId,
      runId: result.runId,
      status: result.status,
      triggeredBy: operator.id,
      mode: data.mode,
      pageStart: data.pageStart,
      maxPages
    });

    return Response.json(
      {
        status: "accepted",
        source: "sreality",
        runId: result.runId,
        scope: "apartments",
        mode: data.mode,
        pageStart: data.pageStart,
        maxPages,
        summary: {
          fetched: result.fetchedCount,
          parsed: result.parsedCount,
          upserted: result.upsertedCount,
          failed: result.failedCount,
          removed: result.removedCount ?? 0
        }
      },
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Forbidden") ? 403 : 500;

    return Response.json({ error: message }, { status });
  }
}
