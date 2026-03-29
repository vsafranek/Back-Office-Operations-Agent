/**
 * Výběr sloupců jen pro náhled v UI — exporty (CSV/Xlsx) vždy berou kompletní řádky z dat.
 */

/** Sloupce detailu obchodů (vw_deal_sales_detail) — pořadí náhledu v UI. */
const DEAL_SALES_COLUMN_ORDER = [
  "sold_at",
  "contract_signed_at",
  "title",
  "city",
  "district",
  "property_kind",
  "full_name",
  "buyer_legal_name",
  "email",
  "phone",
  "sold_price",
  "deal_status",
  "internal_deal_ref",
  "listing_ref",
  "deal_source",
  "deal_id",
  "client_id",
  "property_id",
  "internal_ref"
] as const;

const CLIENT_TABLE_COLUMN_ORDER = [
  "full_name",
  "email",
  "phone",
  "source_channel",
  "preferred_city",
  "preferred_district",
  "property_type_interest",
  "budget_min_czk",
  "budget_max_czk",
  "property_notes",
  "created_at"
] as const;

function orderedKeysFromRows(rows: Record<string, unknown>[]): string[] {
  const keysFromRow =
    rows.length > 0 ? Object.keys(rows[0]!).filter((k) => k !== "id") : [...CLIENT_TABLE_COLUMN_ORDER];
  return [
    ...CLIENT_TABLE_COLUMN_ORDER.filter((k) => keysFromRow.includes(k)),
    ...keysFromRow.filter((k) => !CLIENT_TABLE_COLUMN_ORDER.includes(k as (typeof CLIENT_TABLE_COLUMN_ORDER)[number]))
  ];
}

function orderedKeysFromDealRows(rows: Record<string, unknown>[]): string[] {
  const keysFromRow =
    rows.length > 0 ? Object.keys(rows[0]!) : [...DEAL_SALES_COLUMN_ORDER];
  return [
    ...DEAL_SALES_COLUMN_ORDER.filter((k) => keysFromRow.includes(k)),
    ...keysFromRow.filter((k) => !DEAL_SALES_COLUMN_ORDER.includes(k as (typeof DEAL_SALES_COLUMN_ORDER)[number]))
  ];
}

function cellNonEmpty(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (value instanceof Date) return true;
  if (typeof value === "object") {
    try {
      return Object.keys(value as object).length > 0;
    } catch {
      return true;
    }
  }
  return true;
}

function columnHasAnyValue(rows: Record<string, unknown>[], key: string): boolean {
  return rows.some((r) => cellNonEmpty(r[key]));
}

/** Sloupce s dlouhými texty — v náhledu schovat při větším počtu řádků (Excel má kompletní data). */
const VERBOSE_PREVIEW_KEYS = new Set(["property_notes"]);

function shouldIncludeVerboseColumn(key: string, rows: Record<string, unknown>[]): boolean {
  if (!VERBOSE_PREVIEW_KEYS.has(key)) return true;
  if (rows.length <= 8) return true;
  const maxLen = Math.max(0, ...rows.map((r) => String(r[key] ?? "").length));
  return maxLen <= 120;
}

export type AnalyticsTablePanelKind =
  | "clients_q1"
  | "leads_sales_6m"
  | "clients_filtered"
  | "deal_sales_detail";

export function getAnalyticsTableDisplayKeys(
  panelKind: AnalyticsTablePanelKind,
  rows: Record<string, unknown>[]
): string[] {
  if (rows.length === 0) return [];

  if (panelKind === "leads_sales_6m") {
    const prefer = ["month", "leads_count", "sold_count"] as const;
    const keys = orderedKeysFromRows(rows);
    return prefer.filter((k) => keys.includes(k) && columnHasAnyValue(rows, k));
  }

  if (panelKind === "deal_sales_detail") {
    const keys = orderedKeysFromDealRows(rows).filter((k) => k !== "buyer_snapshot");
    return keys.filter((k) => columnHasAnyValue(rows, k));
  }

  const keys = orderedKeysFromRows(rows);
  const nonEmpty = keys.filter((k) => columnHasAnyValue(rows, k));
  const filtered = nonEmpty.filter((k) => shouldIncludeVerboseColumn(k, rows));
  return filtered.length > 0 ? filtered : nonEmpty;
}
