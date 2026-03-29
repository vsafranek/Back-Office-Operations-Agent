import { z } from "zod";
import { DATASET_IDS } from "@/lib/agent/tools/data-pull-plan";
import { ClientFiltersSchema } from "@/lib/agent/tools/clients-table-query";
import { loadUserDataBrowserPresetPlan } from "@/lib/data/load-user-browser-preset-plan";
import { runDataPullPlanDirect } from "@/lib/agent/tools/sql-tool";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    saved_preset_id: z.string().uuid().optional().nullable(),
    dataset: z.enum(DATASET_IDS).optional().nullable(),
    row_text_narrowing: z.string().max(160).optional().nullable(),
    client_filters: ClientFiltersSchema.optional().nullable(),
    filter_label: z.string().max(220).optional().nullable(),
    suggest_source_channel_chart: z.boolean().optional(),
    suggest_derived_charts: z.boolean().optional(),
    derived_chart_kind_hint: z.enum(["bar", "line", "pie"]).optional().nullable(),
    limit: z.coerce.number().int().min(1).max(200).optional()
  })
  .superRefine((data, ctx) => {
    if (data.saved_preset_id?.trim()) return;
    if (!data.dataset) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dataset"],
        message: "Vyberte dataset nebo uložený preset."
      });
    }
  });

/**
 * Bezpečný dotaz na předdefinované datasety (bez volného SQL).
 * Volitelně `saved_preset_id` — načte uloženou kombinaci z `user_data_browser_presets`.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json({ error: "Neplatné parametry.", details: parsed.error.flatten() }, { status: 400 });
    }
    const b = parsed.data;
    const savedId = b.saved_preset_id?.trim() || null;

    const planInput = savedId
      ? await loadUserDataBrowserPresetPlan(user.id, savedId)
      : {
          dataset: b.dataset!,
          row_text_narrowing: b.row_text_narrowing ?? null,
          client_filters: b.client_filters ?? null,
          filter_label: b.filter_label ?? null,
          suggest_source_channel_chart: b.suggest_source_channel_chart ?? false,
          suggest_derived_charts: b.suggest_derived_charts ?? false,
          derived_chart_kind_hint: b.derived_chart_kind_hint ?? null
        };

    const result = await runDataPullPlanDirect(planInput, b.limit);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer")
        ? 401
        : message.includes("nenalezen")
          ? 404
          : 400;
    return Response.json({ error: message }, { status });
  }
}
