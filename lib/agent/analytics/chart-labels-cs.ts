/**
 * Centrální mapa technických názvů sloupců → české popisky pro grafy a osy.
 * Nové sloupce CRM doplňovat zde (ne hardcodovat v UI).
 */
export const COLUMN_LABEL_CS: Record<string, string> = {
  source_channel: "Zdroj / kanál",
  preferred_city: "Preferované město",
  preferred_district: "Preferovaná čtvrť / oblast",
  property_type_interest: "Typ nemovitosti",
  property_notes: "Poznámky k nemovitosti",
  full_name: "Jméno",
  email: "E-mail",
  phone: "Telefon",
  created_at: "Datum registrace",
  budget_min_czk: "Rozpočet od (Kč)",
  budget_max_czk: "Rozpočet do (Kč)",
  month: "Měsíc",
  leads_count: "Leady",
  sold_count: "Prodané",
  city: "Město",
  district: "Čtvrť",
  title: "Název",
  internal_ref: "Interní reference",
  deal_id: "Obchod (ID)",
  sold_at: "Datum prodeje",
  contract_signed_at: "Podpis smlouvy",
  sold_price: "Prodejní cena",
  deal_status: "Stav obchodu",
  buyer_legal_name: "Kupec (právní jméno)",
  internal_deal_ref: "Interní číslo obchodu",
  listing_ref: "Reference inzerátu",
  deal_source: "Zdroj obchodu",
  property_kind: "Druh nemovitosti",
  client_id: "Klient (ID)",
  property_id: "Nemovitost (ID)"
};

/** Krátké popisky jednotek / metrik podle sloupce a kontextu. */
export function valueUnitForColumn(columnKey: string, mode: "count" | "sum"): string {
  if (mode === "sum") {
    if (columnKey.includes("czk") || columnKey.includes("budget")) return "Kč";
    return "součet";
  }
  if (columnKey === "sold_count" || columnKey === "leads_count") return "počet záznamů";
  return "počet záznamů";
}

export function axisLabelYForCount(columnLabel: string): string {
  return `Počet (${columnLabel.toLowerCase()})`;
}

/** Bezpečný název pro titulek — žádné holé snake_case v UI. */
export function columnLabelCs(columnKey: string): string {
  const mapped = COLUMN_LABEL_CS[columnKey];
  if (mapped) return mapped;
  return columnKey
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
