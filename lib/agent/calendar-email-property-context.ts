import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

function pruneNulls<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object" && !Array.isArray(v) && v !== null && Object.keys(v as object).length === 0) continue;
    out[k] = v;
  }
  return out;
}

function formatAddressLine(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "";
  const a = addr as Record<string, unknown>;
  const street = typeof a.street === "string" ? a.street.trim() : "";
  const city = typeof a.city === "string" ? a.city.trim() : "";
  const district = typeof a.district === "string" ? a.district.trim() : "";
  const postal = typeof a.postal_code === "string" ? a.postal_code.trim() : "";
  const parts = [
    [street, postal].filter(Boolean).join(" "),
    [city, district].filter(Boolean).join(", ")
  ].filter(Boolean);
  return parts.join(", ");
}

function formatPropertyOneLiner(property: Record<string, unknown>): string {
  const title = typeof property.title === "string" ? property.title.trim() : "";
  const loc = formatAddressLine(property.address);
  const priceVal = property.listed_price;
  const listed_price =
    typeof priceVal === "number" && Number.isFinite(priceVal) ? priceVal : null;
  const price = listed_price != null ? `${listed_price.toLocaleString("cs-CZ")} Kč` : null;
  const kind = typeof property.property_kind === "string" ? property.property_kind.trim() : null;
  const areaVal = property.usable_area_m2;
  const area =
    typeof areaVal === "number" && Number.isFinite(areaVal) ? `${areaVal} m²` : null;
  const bits = [
    title || null,
    loc || null,
    kind,
    area,
    price ? `orientační cena ${price}` : null
  ].filter(Boolean);
  return bits.join(" · ");
}

export type CalendarEmailCrmContext = {
  compactPropertySummary: string | null;
  uniquePropertyCount: number;
  crmPayloadForLlm: string;
};

type ChosenRef = { kind: "client" | "lead"; id: string } | null;

/**
 * Určí client_id pro načtení celého CRM kontextu (klient + leady + nemovitosti).
 */
export async function resolveClientIdForCalendarEmail(
  chosen: ChosenRef,
  relatedLeadIds: string[],
  singleCandidate: ChosenRef
): Promise<string | null> {
  const supabase = getSupabaseAdminClient();

  const fromLeadRow = async (leadId: string): Promise<string | null> => {
    const { data } = await supabase.from("leads").select("client_id").eq("id", leadId).maybeSingle();
    const cid = data?.client_id;
    return typeof cid === "string" ? cid : null;
  };

  if (chosen?.kind === "client") return chosen.id;
  if (chosen?.kind === "lead") return fromLeadRow(chosen.id);

  if (relatedLeadIds.length > 0) {
    const first = await fromLeadRow(relatedLeadIds[0]!);
    if (first) return first;
  }

  if (singleCandidate?.kind === "client") return singleCandidate.id;
  if (singleCandidate?.kind === "lead") return fromLeadRow(singleCandidate.id);

  return null;
}

/**
 * Klient + jeho leady + navázané nemovitosti (aktuální schéma: address jsonb, bez city/district sloupců).
 */
export async function fetchCalendarEmailCrmContext(clientId: string): Promise<CalendarEmailCrmContext | null> {
  const supabase = getSupabaseAdminClient();

  const { data: clientRow, error: clientErr } = await supabase
    .from("clients")
    .select(
      "id, full_name, email, phone, source_channel, preferred_city, preferred_district, property_type_interest, budget_min_czk, budget_max_czk, property_notes, created_at"
    )
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr || !clientRow) return null;

  const { data: leadRows, error: leadsErr } = await supabase
    .from("leads")
    .select(
      `id, status, source_channel, created_at, property_id,
       properties (
         id, title, address, listed_price, property_kind, listing_status,
         usable_area_m2, internal_ref, reconstruction_notes, structural_changes,
         reconstruction_status, reconstruction_budget_estimate_czk
       )`
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(18);

  if (leadsErr) return null;

  const clientPayload = pruneNulls(clientRow as Record<string, unknown>);

  const propIds = new Set<string>();
  const lines: string[] = [];

  const interests = (leadRows ?? []).map((row: Record<string, unknown>) => {
    const raw = row.properties;
    const p = Array.isArray(raw) ? (raw[0] as Record<string, unknown> | undefined) : (raw as Record<string, unknown> | null);
    const leadPart = pruneNulls({
      lead_id: row.id,
      status: row.status,
      source_channel: row.source_channel,
      created_at: row.created_at
    });
    if (p && typeof p === "object" && typeof p.id === "string") {
      const pid = p.id as string;
      if (!propIds.has(pid)) {
        propIds.add(pid);
        const line = formatPropertyOneLiner(p);
        if (line) lines.push(line);
      }
      return {
        ...leadPart,
        nemovitost: pruneNulls(p as Record<string, unknown>)
      };
    }
    return leadPart;
  });

  const payload = {
    klient: clientPayload,
    zajem_o_nemovitosti: interests
  };

  const compactPropertySummary =
    lines.length === 0 ? null : lines.length === 1 ? lines[0]! : lines.map((l, i) => `${i + 1}) ${l}`).join("; ");

  return {
    compactPropertySummary,
    uniquePropertyCount: propIds.size,
    crmPayloadForLlm: JSON.stringify(payload, null, 2)
  };
}

/**
 * Textové shrnutí nemovitosti vázané na leady (pro UI / zpětnou kompatibilitu).
 */
export async function fetchPropertySummaryFromLeadIds(leadIds: string[]): Promise<string | null> {
  const ids = [...new Set(leadIds.map((x) => x.trim()).filter(Boolean))];
  if (ids.length === 0) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      `property_id,
       properties ( id, title, address, listed_price, property_kind, usable_area_m2 )`
    )
    .in("id", ids)
    .not("property_id", "is", null);

  if (error || !data?.length) return null;

  const lines: string[] = [];
  const seenProp = new Set<string>();

  for (const row of data as Record<string, unknown>[]) {
    const raw = row.properties;
    const p = Array.isArray(raw) ? raw[0] : raw;
    if (!p || typeof p !== "object") continue;
    const prop = p as Record<string, unknown>;
    const title = typeof prop.title === "string" ? prop.title : "";
    const loc = formatAddressLine(prop.address);
    if (!title?.trim() && !loc) continue;
    const propId = typeof row.property_id === "string" ? row.property_id : "";
    if (!propId || seenProp.has(propId)) continue;
    seenProp.add(propId);

    const one = formatPropertyOneLiner(prop);
    if (one) lines.push(one);
  }

  if (lines.length === 0) return null;
  return lines.length === 1 ? lines[0]! : lines.map((l, i) => `${i + 1}) ${l}`).join("; ");
}

export function crmContextNeedsPropertyDisambiguation(ctx: CalendarEmailCrmContext | null): boolean {
  return ctx != null && ctx.uniquePropertyCount > 1;
}
