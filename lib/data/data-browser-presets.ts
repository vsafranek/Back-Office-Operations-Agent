import {
  DATASET_IDS,
  type DataPullDataset,
  normalizeAsciiForSearch
} from "@/lib/agent/tools/data-pull-plan";

/** Jak je zdroj v Postgresu napojený v `sql-tool` — pro rozlišení v nabídce. */
export type BrowserDataSourceKind = "view" | "table" | "rpc";

export type BrowserTablePreset = {
  id: DataPullDataset;
  title: string;
  description: string;
  /** view → `vw_*`, table → fyzická tabulka, rpc → uložená funkce. */
  sourceKind: BrowserDataSourceKind;
  /** Technický název v DB (bez schématu). */
  dbObjectName: string;
  displayColumnOrder: readonly string[];
  hiddenColumns: readonly string[];
  columnLabels: Partial<Record<string, string>>;
};

const CS: Partial<Record<string, string>> = {
  full_name: "Jméno",
  email: "E-mail",
  phone: "Telefon",
  source_channel: "Zdroj",
  preferred_city: "Město",
  preferred_district: "Čtvrť",
  property_type_interest: "Typ nemovitosti",
  budget_min_czk: "Rozpočet od (Kč)",
  budget_max_czk: "Rozpočet do (Kč)",
  property_notes: "Poznámky",
  created_at: "Vytvořeno",
  month: "Měsíc",
  leads_count: "Počet leadů",
  sold_count: "Prodáno (byty)",
  status: "Stav (lead)",
  expected_value_czk_sum: "Očekávaná hodnota Σ (Kč)",
  oldest_lead_at: "Nejstarší lead",
  newest_lead_at: "Nejnovější lead",
  sold_at: "Datum prodeje",
  contract_signed_at: "Podpis smlouvy",
  sold_price: "Cena",
  deal_status: "Stav obchodu",
  internal_deal_ref: "Interní ref.",
  listing_ref: "Inzerát",
  buyer_legal_name: "Kupující (právně)",
  title: "Nemovitost",
  city: "Město",
  district: "Část",
  property_kind: "Druh",
  internal_ref: "Interní ref. nem.",
  missing_reconstruction: "Chybí rekonstrukce",
  missing_structural_changes: "Chybí stavební úpravy",
  reconstruction_status: "Stav rekonstrukce",
  reconstruction_budget_estimate_czk: "Odhad rozpočtu rek.",
  reconstruction_last_reviewed_at: "Poslední kontrola",
  address: "Adresa (JSON)",
  listing_status: "Stav nabídky",
  usable_area_m2: "Plocha (m²)",
  reconstruction_notes: "Poznámky rekonstrukce",
  structural_changes: "Stavební úpravy",
  client_full_name: "Klient — jméno",
  client_email: "Klient — e-mail",
  client_phone: "Klient — telefon",
  property_title: "Nemovitost — název",
  property_internal_ref: "Nemovitost — interní ref.",
  property_kind_label: "Nemovitost — druh",
  property_listed_price: "Nemovitost — cena nabídky",
  lead_status: "Lead — stav",
  lead_expected_value_czk: "Lead — oček. hodnota (Kč)",
  lead_source_channel: "Lead — zdroj",
  lead_notes: "Lead — poznámky",
  commission_czk: "Provize (Kč)",
  commission_rate_pct: "Provize (%)",
  deal_source: "Zdroj obchodu",
  lost_reason: "Důvod ztráty",
  notes: "Poznámky",
  last_contact_at: "Poslední kontakt",
  updated_at: "Aktualizováno"
};

export const DATA_BROWSER_PRESETS: Record<DataPullDataset, BrowserTablePreset> = {
  new_clients_q1: {
    id: "new_clients_q1",
    title: "Noví klienti (Q1)",
    description: "Klienti založení v 1. čtvrtletí běžného roku (Kalendář Praha).",
    sourceKind: "view",
    dbObjectName: "vw_new_clients_q1",
    displayColumnOrder: [
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
    ],
    hiddenColumns: ["id"],
    columnLabels: CS
  },
  clients: {
    id: "clients",
    title: "Klienti",
    description: "Kompletní tabulka klientů z CRM (omezený počet řádků).",
    sourceKind: "table",
    dbObjectName: "clients",
    displayColumnOrder: [
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
    ],
    hiddenColumns: ["id"],
    columnLabels: CS
  },
  properties: {
    id: "properties",
    title: "Nemovitosti",
    description: "Tabulka properties — adresa v JSON, ref., druh, nabídka, rekonstrukce.",
    sourceKind: "table",
    dbObjectName: "properties",
    displayColumnOrder: [
      "title",
      "internal_ref",
      "property_kind",
      "listing_status",
      "listed_price",
      "usable_area_m2",
      "reconstruction_status",
      "reconstruction_budget_estimate_czk",
      "reconstruction_last_reviewed_at",
      "reconstruction_notes",
      "structural_changes",
      "address",
      "created_at"
    ],
    hiddenColumns: ["id", "building_works_checklist"],
    columnLabels: CS
  },
  deals: {
    id: "deals",
    title: "Obchody",
    description: "Tabulka deals — místo ID jsou zobrazeny klient, nemovitost a lead (JOIN).",
    sourceKind: "table",
    dbObjectName: "deals",
    displayColumnOrder: [
      "sold_at",
      "sold_price",
      "status",
      "deal_source",
      "commission_czk",
      "commission_rate_pct",
      "client_full_name",
      "client_email",
      "client_phone",
      "property_title",
      "property_internal_ref",
      "property_kind_label",
      "property_listed_price",
      "lead_status",
      "lead_expected_value_czk",
      "lead_source_channel",
      "lead_notes",
      "created_at"
    ],
    hiddenColumns: ["id", "property_id", "client_id", "lead_id"],
    columnLabels: CS
  },
  leads: {
    id: "leads",
    title: "Leady",
    description: "Tabulka leads — klient a nemovitost přes vazby jako čitelné sloupce.",
    sourceKind: "table",
    dbObjectName: "leads",
    displayColumnOrder: [
      "status",
      "source_channel",
      "expected_value_czk",
      "lost_reason",
      "client_full_name",
      "client_email",
      "client_phone",
      "property_title",
      "property_internal_ref",
      "property_kind_label",
      "property_listed_price",
      "notes",
      "created_at",
      "updated_at",
      "last_contact_at"
    ],
    hiddenColumns: ["id", "client_id", "property_id"],
    columnLabels: CS
  },
  leads_vs_sales_6m: {
    id: "leads_vs_sales_6m",
    title: "Leady vs. prodeje",
    description: "Měsíční přehled leadů a prodaných bytů za posledních 6 měsíců.",
    sourceKind: "view",
    dbObjectName: "vw_leads_vs_sales_6m",
    displayColumnOrder: ["month", "leads_count", "sold_count"],
    hiddenColumns: [],
    columnLabels: CS
  },
  lead_pipeline_summary: {
    id: "lead_pipeline_summary",
    title: "Leady — pipeline (podle stavu)",
    description: "Agregace leadů podle statusu: počty, součet očekávané hodnoty, rozsah datumů.",
    sourceKind: "view",
    dbObjectName: "vw_lead_pipeline_summary",
    displayColumnOrder: [
      "status",
      "leads_count",
      "expected_value_czk_sum",
      "oldest_lead_at",
      "newest_lead_at"
    ],
    hiddenColumns: [],
    columnLabels: CS
  },
  deal_sales_detail: {
    id: "deal_sales_detail",
    title: "Prodeje — detail",
    description: "Řádky uzavřených obchodů: nemovitost, kupec, cena, datum.",
    sourceKind: "view",
    dbObjectName: "vw_deal_sales_detail",
    displayColumnOrder: [
      "sold_at",
      "title",
      "full_name",
      "email",
      "phone",
      "city",
      "district",
      "property_kind",
      "sold_price",
      "buyer_legal_name",
      "internal_deal_ref",
      "listing_ref",
      "deal_status",
      "contract_signed_at"
    ],
    hiddenColumns: ["deal_id", "client_id", "property_id", "buyer_snapshot"],
    columnLabels: CS
  },
  missing_reconstruction: {
    id: "missing_reconstruction",
    title: "Nemovitosti — rekonstrukce",
    description: "Portfolio položek s chybějícími údaji o rekonstrukci / stavebních úpravách.",
    sourceKind: "rpc",
    dbObjectName: "fn_missing_reconstruction_data",
    displayColumnOrder: [
      "title",
      "city",
      "reconstruction_status",
      "missing_reconstruction",
      "missing_structural_changes",
      "reconstruction_budget_estimate_czk",
      "reconstruction_last_reviewed_at"
    ],
    hiddenColumns: ["property_id", "address", "building_works_checklist"],
    columnLabels: CS
  }
};

const BROWSER_SELECT_GROUP = {
  view: "Pohledy (VIEW)",
  table: "Tabulky",
  rpc: "Funkce (RPC)"
} as const;

/** Jednořádkový doplněk k popisu výběru — DB typ + objekt. */
export function browserPresetSourceCaption(dataset: DataPullDataset): string {
  const p = DATA_BROWSER_PRESETS[dataset];
  if (p.sourceKind === "view") return `SQL VIEW · ${p.dbObjectName}`;
  if (p.sourceKind === "table") return `Tabulka · ${p.dbObjectName}`;
  return `RPC · ${p.dbObjectName}()`;
}

/** Mantine 8: položka s `group` musí mít `items[]`, ne flat `value`/`label`. */
export function listBrowserTableSelectData(
  saved?: { id: string; name: string }[]
): { group: string; items: { value: string; label: string }[] }[] {
  const viewItems: { value: string; label: string }[] = [];
  const tableItems: { value: string; label: string }[] = [];
  const rpcItems: { value: string; label: string }[] = [];

  for (const id of DATASET_IDS) {
    const preset = DATA_BROWSER_PRESETS[id];
    const item = { value: id, label: preset.title };
    if (preset.sourceKind === "view") viewItems.push(item);
    else if (preset.sourceKind === "table") tableItems.push(item);
    else rpcItems.push(item);
  }

  const groups: { group: string; items: { value: string; label: string }[] }[] = [];
  if (viewItems.length) groups.push({ group: BROWSER_SELECT_GROUP.view, items: viewItems });
  if (tableItems.length) groups.push({ group: BROWSER_SELECT_GROUP.table, items: tableItems });
  if (rpcItems.length) groups.push({ group: BROWSER_SELECT_GROUP.rpc, items: rpcItems });

  if (saved?.length) {
    groups.push({
      group: "Uložené pohledy",
      items: saved.map((s) => ({ value: `saved:${s.id}`, label: s.name }))
    });
  }
  return groups;
}

export function getDisplayColumns(
  dataset: DataPullDataset,
  sampleRow: Record<string, unknown> | undefined
): string[] {
  const preset = DATA_BROWSER_PRESETS[dataset];
  const hidden = new Set(preset.hiddenColumns);
  const keys = sampleRow ? Object.keys(sampleRow) : [...preset.displayColumnOrder];
  const ordered: string[] = [];
  for (const c of preset.displayColumnOrder) {
    if (keys.includes(c) && !hidden.has(c)) ordered.push(c);
  }
  for (const c of [...keys].sort()) {
    if (hidden.has(c) || ordered.includes(c)) continue;
    ordered.push(c);
  }
  return ordered;
}

export function columnHeaderLabel(dataset: DataPullDataset, key: string): string {
  return DATA_BROWSER_PRESETS[dataset].columnLabels[key] ?? key;
}

export function formatBrowserCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Ano" : "Ne";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : value.toLocaleString("cs-CZ");
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString("cs-CZ");
  }
  return s;
}

export function rowMatchesColumnFilters(
  row: Record<string, unknown>,
  filters: Record<string, string>,
  columns: string[]
): boolean {
  for (const col of columns) {
    const term = filters[col]?.trim();
    if (!term) continue;
    const t = normalizeAsciiForSearch(term);
    const val = row[col];
    const s =
      val == null
        ? ""
        : typeof val === "object"
          ? normalizeAsciiForSearch(JSON.stringify(val))
          : normalizeAsciiForSearch(String(val));
    if (!s.includes(t)) return false;
  }
  return true;
}
