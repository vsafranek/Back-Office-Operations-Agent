import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Sloupce tabulky `clients` povolené pro filtrování z agenta (žádné volné SQL). */
export const ClientQueryableTextColumnSchema = z.enum([
  "full_name",
  "email",
  "phone",
  "source_channel",
  "preferred_city",
  "preferred_district",
  "property_type_interest",
  "property_notes"
]);

export const ClientQueryableNumericColumnSchema = z.enum(["budget_min_czk", "budget_max_czk"]);

const ClientColumnForNullSchema = z.union([ClientQueryableTextColumnSchema, ClientQueryableNumericColumnSchema]);

export const ClientFilterSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text_ilike"),
    column: ClientQueryableTextColumnSchema,
    value: z.string().max(200)
  }),
  z.object({
    kind: z.literal("text_eq"),
    column: ClientQueryableTextColumnSchema,
    value: z.string().max(200)
  }),
  z.object({
    kind: z.literal("is_null"),
    column: ClientColumnForNullSchema
  }),
  z.object({
    kind: z.literal("num_gte"),
    column: ClientQueryableNumericColumnSchema,
    value: z.number()
  }),
  z.object({
    kind: z.literal("num_lte"),
    column: ClientQueryableNumericColumnSchema,
    value: z.number()
  }),
  z.object({
    kind: z.literal("num_eq"),
    column: ClientQueryableNumericColumnSchema,
    value: z.number()
  })
]);

export const ClientFiltersSchema = z.array(ClientFilterSchema).max(15);

export type ClientFilter = z.infer<typeof ClientFilterSchema>;

/**
 * Znehodnotí znaky, které lámají PostgREST `.or(...)` (čárky oddělují větve OR)
 * a LIKE wildcards přidané aplikací.
 */
export function sanitizeClientSearchFragment(raw: string): string {
  return raw
    .replace(/[%*,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

/**
 * Volný text stejně jako dřívější RPC: OR přes čtvrť, město, poznámky (parametry, ne skládání SQL řetězce).
 */
export function buildClientsTableQuery(
  supabase: SupabaseClient,
  params: {
    /** OR přes preferred_district, preferred_city, property_notes */
    freeTextAreaOrNotes?: string | null;
    filters?: ClientFilter[] | null;
    limit: number;
  }
) {
  const parts: string[] = ["clients"];
  let q = supabase.from("clients").select("*");

  const ft = params.freeTextAreaOrNotes?.trim();
  if (ft) {
    const inner = sanitizeClientSearchFragment(ft);
    if (inner) {
      const p = `%${inner}%`;
      q = q.or(
        `preferred_district.ilike.${p},preferred_city.ilike.${p},property_notes.ilike.${p}`
      );
      parts.push(`or_ilike_area·«${inner}»`);
    }
  }

  for (const f of params.filters ?? []) {
    switch (f.kind) {
      case "text_eq":
        q = q.eq(f.column, f.value);
        parts.push(`${f.column}.eq`);
        break;
      case "text_ilike": {
        const v = sanitizeClientSearchFragment(f.value);
        if (v) {
          q = q.ilike(f.column, `%${v}%`);
          parts.push(`${f.column}.ilike`);
        }
        break;
      }
      case "is_null":
        q = q.is(f.column, null);
        parts.push(`${f.column}.is_null`);
        break;
      case "num_gte":
        q = q.gte(f.column, f.value);
        parts.push(`${f.column}.gte`);
        break;
      case "num_lte":
        q = q.lte(f.column, f.value);
        parts.push(`${f.column}.lte`);
        break;
      case "num_eq":
        q = q.eq(f.column, f.value);
        parts.push(`${f.column}.num_eq`);
        break;
    }
  }

  q = q.order("created_at", { ascending: false }).limit(params.limit);
  return { builder: q, sourceLabel: parts.join(" + ") };
}
