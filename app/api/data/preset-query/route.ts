import { z } from "zod";
import { DATASET_IDS } from "@/lib/agent/tools/data-pull-plan";
import { ClientFiltersSchema } from "@/lib/agent/tools/clients-table-query";
import { runDataPullPlanDirect } from "@/lib/agent/tools/sql-tool";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  dataset: z.enum(DATASET_IDS),
  row_text_narrowing: z.string().max(160).optional().nullable(),
  client_filters: ClientFiltersSchema.optional().nullable(),
  filter_label: z.string().max(220).optional().nullable(),
  suggest_source_channel_chart: z.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

/**
 * Bezpečný dotaz na předdefinované datasety (bez volného SQL).
 */
export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser(request);
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json({ error: "Neplatné parametry.", details: parsed.error.flatten() }, { status: 400 });
    }
    const b = parsed.data;
    const result = await runDataPullPlanDirect(
      {
        dataset: b.dataset,
        row_text_narrowing: b.row_text_narrowing ?? null,
        client_filters: b.client_filters ?? null,
        filter_label: b.filter_label ?? null,
        suggest_source_channel_chart: b.suggest_source_channel_chart ?? false
      },
      b.limit
    );
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer")
        ? 401
        : 400;
    return Response.json({ error: message }, { status });
  }
}
