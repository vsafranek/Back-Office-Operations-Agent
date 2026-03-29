import { z } from "zod";
import { DATASET_IDS } from "@/lib/agent/tools/data-pull-plan";
import { ClientFiltersSchema } from "@/lib/agent/tools/clients-table-query";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

const datasetEnum = z.enum(DATASET_IDS);

const columnFiltersSchema = z
  .record(z.string().max(64), z.string().max(160))
  .optional()
  .nullable()
  .superRefine((val, ctx) => {
    if (!val) return;
    if (Object.keys(val).length > 40) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "column_filters_max_keys" });
    }
  });

const createBodySchema = z.object({
  name: z.string().min(1).max(120),
  base_dataset: datasetEnum,
  row_text_narrowing: z.string().max(160).optional().nullable(),
  client_filters: ClientFiltersSchema.optional().nullable(),
  filter_label: z.string().max(220).optional().nullable(),
  column_filters: columnFiltersSchema,
  suggest_source_channel_chart: z.boolean().optional(),
  suggest_derived_charts: z.boolean().optional(),
  derived_chart_kind_hint: z.enum(["bar", "line", "pie"]).optional().nullable()
});

function httpError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_data_browser_presets")
      .select("id, name, base_dataset, row_text_narrowing, column_filters, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return Response.json({ presets: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer")
        ? 401
        : 400;
    return httpError(message, status);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const json: unknown = await request.json();
    const parsed = createBodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json({ error: "Neplatné parametry.", details: parsed.error.flatten() }, { status: 400 });
    }
    const b = parsed.data;
    const cfRaw = b.column_filters;
    const column_filters =
      cfRaw && typeof cfRaw === "object"
        ? Object.fromEntries(
            Object.entries(cfRaw)
              .filter(([k, v]) => k.trim().length > 0 && typeof v === "string" && v.trim().length > 0)
              .map(([k, v]) => [k.trim(), v.trim().slice(0, 160)])
          )
        : {};
    const column_filters_db = Object.keys(column_filters).length > 0 ? column_filters : null;

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_data_browser_presets")
      .insert({
        user_id: user.id,
        name: b.name.trim(),
        base_dataset: b.base_dataset,
        row_text_narrowing: b.row_text_narrowing?.trim() || null,
        client_filters: b.client_filters ?? null,
        filter_label: b.filter_label?.trim() || null,
        column_filters: column_filters_db,
        suggest_source_channel_chart: b.suggest_source_channel_chart ?? false,
        suggest_derived_charts: b.suggest_derived_charts ?? false,
        derived_chart_kind_hint: b.derived_chart_kind_hint ?? null,
        updated_at: new Date().toISOString()
      })
      .select("id, name, base_dataset, row_text_narrowing, column_filters, created_at")
      .single();

    if (error) throw new Error(error.message);
    return Response.json({ preset: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer")
        ? 401
        : 400;
    return httpError(message, status);
  }
}
