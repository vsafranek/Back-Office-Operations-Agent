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

/** Jediny casovy sloupec v tabulce `clients` pro strukturovane filtry (timestamptz). */
export const ClientQueryableTimestamptzColumnSchema = z.literal("created_at");

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
    kind: z.literal("text_starts_with"),
    column: ClientQueryableTextColumnSchema,
    value: z.string().max(120)
  }),
  z.object({
    kind: z.literal("text_in"),
    column: ClientQueryableTextColumnSchema,
    values: z.array(z.string().min(1).max(200)).min(1).max(20)
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
  }),
  z.object({
    kind: z.literal("num_gt"),
    column: ClientQueryableNumericColumnSchema,
    value: z.number()
  }),
  z.object({
    kind: z.literal("num_lt"),
    column: ClientQueryableNumericColumnSchema,
    value: z.number()
  }),
  z.object({
    kind: z.literal("ts_gte"),
    column: ClientQueryableTimestamptzColumnSchema,
    value: z.string().min(8).max(40)
  }),
  z.object({
    kind: z.literal("ts_lte"),
    column: ClientQueryableTimestamptzColumnSchema,
    value: z.string().min(8).max(40)
  }),
  z.object({
    kind: z.literal("ts_eq"),
    column: ClientQueryableTimestamptzColumnSchema,
    value: z.string().min(8).max(40)
  }),
  z.object({
    kind: z.literal("id_eq"),
    value: z.string().uuid()
  })
]);

export const ClientFiltersSchema = z.array(ClientFilterSchema).max(20);

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

/** Normalizace na ISO pro PostgREST; neplatne retezce ignoruj (filter se neaplikuje). */
export function coerceTimestamptzFilterValue(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function sanitizeTextInValue(raw: string): string {
  return raw.replace(/%/g, "").replace(/,/g, " ").trim().slice(0, 200);
}

/**
 * Volný text: OR přes jméno, kontakt, kanál, preference a poznámky (parametry, ne skládání SQL).
 */
export function buildClientsTableQuery(
  supabase: SupabaseClient,
  params: {
    /** OR přes hlavní textové sloupce řádku klienta */
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
        [
          "full_name",
          "email",
          "phone",
          "source_channel",
          "preferred_district",
          "preferred_city",
          "property_notes",
          "property_type_interest"
        ]
          .map((col) => `${col}.ilike.${p}`)
          .join(",")
      );
      parts.push(`or_ilike_client·«${inner}»`);
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
      case "text_starts_with": {
        const v = sanitizeClientSearchFragment(f.value);
        if (v) {
          q = q.ilike(f.column, `${v}%`);
          parts.push(`${f.column}.prefix`);
        }
        break;
      }
      case "text_in": {
        const cleaned = f.values.map(sanitizeTextInValue).filter((x) => x.length > 0);
        if (cleaned.length > 0) {
          q = q.in(f.column, cleaned);
          parts.push(`${f.column}.in(${cleaned.length})`);
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
      case "num_gt":
        q = q.gt(f.column, f.value);
        parts.push(`${f.column}.gt`);
        break;
      case "num_lt":
        q = q.lt(f.column, f.value);
        parts.push(`${f.column}.lt`);
        break;
      case "ts_gte": {
        const iso = coerceTimestamptzFilterValue(f.value);
        if (iso) {
          q = q.gte(f.column, iso);
          parts.push(`${f.column}.ts_gte`);
        }
        break;
      }
      case "ts_lte": {
        const iso = coerceTimestamptzFilterValue(f.value);
        if (iso) {
          q = q.lte(f.column, iso);
          parts.push(`${f.column}.ts_lte`);
        }
        break;
      }
      case "ts_eq": {
        const iso = coerceTimestamptzFilterValue(f.value);
        if (iso) {
          q = q.eq(f.column, iso);
          parts.push(`${f.column}.ts_eq`);
        }
        break;
      }
      case "id_eq":
        q = q.eq("id", f.value);
        parts.push("id.eq");
        break;
    }
  }

  q = q.order("created_at", { ascending: false }).limit(params.limit);
  return { builder: q, sourceLabel: parts.join(" + ") };
}
