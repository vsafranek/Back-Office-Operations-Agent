import { z } from "zod";
import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";
import { ClientFiltersSchema } from "@/lib/agent/tools/clients-table-query";

/** Pevná sada datových zdrojů v DB — nové typy otázek řeší plán (filtry), ne nové presety. */
export const DATASET_IDS = [
  "new_clients_q1",
  "leads_vs_sales_6m",
  "clients",
  "missing_reconstruction"
] as const;

export type DataPullDataset = (typeof DATASET_IDS)[number];

const chartKindHint = z.enum(["bar", "line", "pie"]);

export const DataPullPlanSchema = z.object({
  dataset: z.enum(DATASET_IDS),
  row_text_narrowing: z.string().max(160).nullable().optional(),
  /** Strukturované filtry tabulky `clients` (whitelist sloupců v ClientFilterSchema). */
  client_filters: ClientFiltersSchema.nullable().optional(),
  filter_label: z.string().max(220).nullable().optional(),
  suggest_source_channel_chart: z.boolean().optional(),
  /** U datasetu `clients`: zda navrhnout odvozené grafy z načtených řádků (bez dalšího SQL). */
  suggest_derived_charts: z.boolean().optional(),
  /** U `clients`: preferovaný typ vizualizace (jen hint; agregace zůstává stejná). */
  derived_chart_kind_hint: chartKindHint.nullable().optional()
});

export type DataPullPlan = z.infer<typeof DataPullPlanSchema>;

export function normalizeAsciiForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const ROW_TEXT_COLUMNS = [
  "preferred_district",
  "preferred_city",
  "property_notes",
  "full_name",
  "email",
  "source_channel",
  "phone",
  "property_type_interest"
] as const;

/** Sloupce řádků z `fn_missing_reconstruction_data` a obdobných výpisů nemovitostí. */
const PROPERTY_ROW_TEXT_COLUMNS = ["title", "city", "district", "internal_ref"] as const;

const ADDRESS_SEARCH_KEYS = [
  "city",
  "district",
  "street",
  "postal_code",
  "postalCode",
  "region",
  "country"
] as const;

/** Texty z `address` (jsonb) pro textové zúžení řádků. */
function addressJsonSearchStrings(addr: unknown): string[] {
  let o: Record<string, unknown> | null = null;
  if (typeof addr === "object" && addr !== null && !Array.isArray(addr)) {
    o = addr as Record<string, unknown>;
  } else if (typeof addr === "string") {
    try {
      const p = JSON.parse(addr) as unknown;
      if (typeof p === "object" && p !== null && !Array.isArray(p)) o = p as Record<string, unknown>;
    } catch {
      return [addr];
    }
  }
  if (!o) return [];
  return ADDRESS_SEARCH_KEYS.flatMap((k) => {
    const v = o![k];
    return typeof v === "string" ? [v] : [];
  });
}

function rowMatchesTextNarrowing(row: Record<string, unknown>, t: string): boolean {
  const includesTerm = (s: string) => normalizeAsciiForSearch(s).includes(t);
  for (const c of ROW_TEXT_COLUMNS) {
    const v = row[c];
    if (typeof v === "string" && includesTerm(v)) return true;
  }
  for (const c of PROPERTY_ROW_TEXT_COLUMNS) {
    const v = row[c];
    if (typeof v === "string" && includesTerm(v)) return true;
  }
  for (const s of addressJsonSearchStrings(row.address)) {
    if (includesTerm(s)) return true;
  }
  const pid = row.property_id;
  if (pid != null && includesTerm(String(pid))) return true;
  return false;
}

/** Zúžení již načtených řádků (views) podle volného textu — bez nových SQL presetů. */
export function narrowRowsByText(rows: Record<string, unknown>[], term: string): Record<string, unknown>[] {
  const t = normalizeAsciiForSearch(term.trim());
  if (!t) return rows;
  return rows.filter((row) => rowMatchesTextNarrowing(row, t));
}

/** Známe čtvrti / města — pro heuristický fallback bez LLM. */
const AREA_NEEDLES: { needle: string; display: string }[] = [
  { needle: "dejvice", display: "Dejvice" },
  { needle: "karlin", display: "Karlín" },
  { needle: "holesovice", display: "Holešovice" },
  { needle: "vrsovice", display: "Vršovice" },
  { needle: "zizkov", display: "Žižkov" },
  { needle: "smichov", display: "Smíchov" },
  { needle: "liben", display: "Libeň" },
  { needle: "stred", display: "Střed" },
  { needle: "brno", display: "Brno" },
  { needle: "praha", display: "Praha" }
];

export function extractClientAreaSearchTerm(question: string): string | null {
  const prefer = question.match(/preferuje\s+([^?(\n]+?)(?:\s*\(|$|\?)/i);
  if (prefer?.[1]) {
    const t = prefer[1].trim().replace(/\s+/g, " ");
    if (t.length >= 2) return t;
  }
  const n = normalizeAsciiForSearch(question);
  for (const { needle, display } of AREA_NEEDLES) {
    if (n.includes(needle)) return display;
  }
  return null;
}

/**
 * Záložní plán bez LLM (síť Down / neplatný JSON) — krátké heuristiky, ne rostoucí seznam presetů.
 */
const MISSING_RECONSTRUCTION_FILTER_LABEL =
  "Nemovitosti — chybějící údaje o rekonstrukci / stavebních úpravách";

/*
 * Fáze B (časový horizont „cokoliv“) — návrh bez implementace:
 * - Rozšířit plán o volitelné date_from / date_to (Europe/Prague) a mapovat je na RPC
 *   např. fn_clients_in_range(from, to) nebo predikáty v client_filters (ts_gte, ts_lte na created_at).
 * - new_clients_q1 zůstává view jen pro Q1 běžného roku; obecné období obsluhovat přes clients + filtry nebo nový view.
 * - executePlan v sql-tool volá jen allowlistované zdroje; žádné volné SQL z NL.
 */

function wantsMissingReconstructionDataset(n: string): boolean {
  if (n.includes("rekonstruk")) return true;
  const mentionsProperty =
    n.includes("nemovitost") || n.includes("portfolio") || n.includes("inzerat");
  const mentionsStructuralWork = n.includes("stavebn") && n.includes("uprav");
  const mentionsMissingData = n.includes("chyb") && (n.includes("data") || n.includes("udaj"));
  if (mentionsStructuralWork && mentionsProperty) return true;
  if (mentionsMissingData && (n.includes("rekonstruk") || mentionsStructuralWork)) return true;
  return false;
}

export function fallbackPlanFromQuestion(question: string): DataPullPlan {
  const n = normalizeAsciiForSearch(question);

  if (wantsMissingReconstructionDataset(n)) {
    return {
      dataset: "missing_reconstruction",
      row_text_narrowing: null,
      client_filters: null,
      filter_label: MISSING_RECONSTRUCTION_FILTER_LABEL,
      suggest_source_channel_chart: false,
      suggest_derived_charts: false,
      derived_chart_kind_hint: null
    };
  }

  if ((n.includes("lead") || n.includes("prodej") || n.includes("prodan")) && n.includes("mesic")) {
    return {
      dataset: "leads_vs_sales_6m",
      row_text_narrowing: null,
      client_filters: null,
      filter_label: null,
      suggest_source_channel_chart: false,
      suggest_derived_charts: false,
      derived_chart_kind_hint: null
    };
  }

  if (n.includes("ctvrtleti") || n.includes("ctvrtlet")) {
    const q1Like =
      n.includes("1.") ||
      n.includes("prvni") ||
      n.includes("prvniho") ||
      n.includes("i.") ||
      n.includes(" q1") ||
      n.startsWith("q1");
    const mentionsClientLoose =
      n.includes("klient") ||
      n.includes("zakaznik") ||
      n.includes("zakaznici") ||
      n.includes("zakaznic");
    if (q1Like && mentionsClientLoose) {
      return {
        dataset: "new_clients_q1",
        row_text_narrowing: null,
        client_filters: null,
        filter_label: "Noví klienti — Q1 (view)",
        suggest_source_channel_chart: true,
        suggest_derived_charts: false,
        derived_chart_kind_hint: null
      };
    }
  }

  const mentionsClient = n.includes("klient") || n.includes("zakaznik") || n.includes("zakaznici");

  const areaTerm = extractClientAreaSearchTerm(question);
  if (mentionsClient && areaTerm) {
    return {
      dataset: "clients",
      row_text_narrowing: areaTerm,
      client_filters: null,
      filter_label: `Klienti — shoda v oblasti / městě / poznámkách („${areaTerm}“)`,
      suggest_source_channel_chart: false,
      suggest_derived_charts: false,
      derived_chart_kind_hint: null
    };
  }

  const mentionsQuarter =
    n.includes("kvartal") ||
    n.includes("q1") ||
    n.includes("1.kvartal") ||
    n.includes("1. kvartal") ||
    n.includes("prvni kvartal") ||
    n.includes("prvni kvartalu");

  const mentionsAcquisition =
    n.includes("odkud") || n.includes("zdroj") || n.includes("prisli") || n.includes("prichazi");

  const wantsChartNotDeck =
    (n.includes("graf") || n.includes("znazorn") || n.includes("vizualiz") || n.includes("chart")) &&
    !n.includes("prezentac") &&
    !n.includes("powerpoint") &&
    !n.includes("pptx") &&
    !n.includes("slid");

  const wantsPie =
    n.includes("kolac") || n.includes("podil") || n.includes("rozlozeni");

  const mentionsNovCustomers =
    (n.includes("nov") && (n.includes("klient") || n.includes("zakaznik") || n.includes("zakaznici"))) ||
    n.includes("novack") ||
    n.includes("novacek");

  const wantsQ1NewClients =
    (mentionsClient &&
      (mentionsQuarter ||
        mentionsAcquisition ||
        wantsChartNotDeck ||
        mentionsNovCustomers ||
        (n.includes("nov") && mentionsQuarter))) ||
    (mentionsNovCustomers && (mentionsQuarter || n.includes("q1")));

  if (wantsQ1NewClients) {
    return {
      dataset: "new_clients_q1",
      row_text_narrowing: null,
      client_filters: null,
      filter_label: "Noví klienti — Q1 (view)",
      suggest_source_channel_chart: mentionsQuarter || mentionsAcquisition || wantsChartNotDeck,
      suggest_derived_charts: false,
      derived_chart_kind_hint: null
    };
  }

  if (mentionsClient) {
    return {
      dataset: "clients",
      row_text_narrowing: null,
      client_filters: null,
      filter_label: "Klienti (tabulka)",
      suggest_source_channel_chart: false,
      suggest_derived_charts: wantsChartNotDeck || wantsPie,
      derived_chart_kind_hint: wantsPie ? ("pie" as const) : null
    };
  }

  return {
    dataset: "clients",
    row_text_narrowing: null,
    client_filters: null,
    filter_label: "Klienti (tabulka) — obecný dotaz bez jasného datového presetu",
    suggest_source_channel_chart: false,
    suggest_derived_charts: false,
    derived_chart_kind_hint: null
  };
}

export function coercePlan(raw: DataPullPlan): DataPullPlan {
  const cf = raw.client_filters?.length ? raw.client_filters.slice(0, 20) : null;
  return {
    dataset: raw.dataset,
    row_text_narrowing: raw.row_text_narrowing?.trim() || null,
    client_filters: cf,
    filter_label: raw.filter_label?.trim() || null,
    suggest_source_channel_chart:
      raw.dataset === "new_clients_q1"
        ? raw.suggest_source_channel_chart == null
          ? true
          : raw.suggest_source_channel_chart
        : false,
    suggest_derived_charts: raw.dataset === "clients" ? raw.suggest_derived_charts === true : false,
    derived_chart_kind_hint: raw.dataset === "clients" ? raw.derived_chart_kind_hint ?? null : null
  };
}

/** LLM z kontextu zvolí zdroj a případné textové zúžení řádků. */
export async function inferDataPullPlan(params: {
  question: string;
  runId: string;
  trace?: { recorder: AgentTraceRecorder; parentId: string | null };
}): Promise<DataPullPlan> {
  const traceParams = params.trace
    ? { recorder: params.trace.recorder, parentId: params.trace.parentId, name: "llm.data_pull.plan" as const }
    : undefined;

  const system = [
    "Jsi planovac internich dotazu pro back office realitni firmy (CRM klienti, leady, nemovitosti).",
    "Z uzivatele otazky vyber JEDEN zpusob dotazu nad daty v aplikaci. Vrat POUZE jeden JSON objekt (bez markdownu).",
    "Povinne klice: dataset, row_text_narrowing (string|null), client_filters (pole|null), filter_label (string|null), suggest_source_channel_chart (boolean), suggest_derived_charts (boolean), derived_chart_kind_hint (\"bar\"|\"line\"|\"pie\"|null).",
    "",
    'dataset: presne jedna z retezcu: "new_clients_q1" | "leads_vs_sales_6m" | "clients" | "missing_reconstruction".',
    "",
    "Dostupne datasety:",
    "- new_clients_q1: rychla kohorta „novi v Q1 bezného roku“ pres view (Europe/Prague). Pouze kdyz presne sedi toto okno; jinak vzdy dataset clients + filtry na created_at.",
    "- leads_vs_sales_6m: leady vs prodane byty za poslednich ~6 mesicu (view).",
    "- clients: primarni zdroj pro klienty — vsechny sloupce tabulky; kombinuj client_filters (viz nize) a/nebo row_text_narrowing. Pro libovolne obdobi / rok / kvartal: ts_gte a ts_lte na created_at (ISO 8601, napr. 2025-01-01T00:00:00.000Z). Tim obejdes nutnost mit view pro kazdy use case.",
    "- missing_reconstruction: nemovitosti bez rekonstrukcnich udaju / stavebnich uprav ve smyslu interniho checku.",
    "",
    "Vyber dataset podle SMYSLU entity a obdobi, ne podle klicovych slov:",
    "- striktne „novi v Q1 tohoto roku“ jako ve view → new_clients_q1.",
    "- jiny rok, jine kvartal, rozsah od-do, poslednich N dni (vyjadreno datumy) → clients + ts_gte/ts_lte na created_at.",
    "- obecny dotaz na klienty → clients.",
    "",
    "row_text_narrowing: u clients volitelne OR pres full_name, email, phone, source_channel, preferred_*, property_* (stejna logika jako backend). u missing_reconstruction OR v title, city, address jsonb, internal_ref, property_id. null pokud staci jen client_filters.",
    "",
    "client_filters: pole az 20 podminek pro dataset clients — kazda polozka ma \"kind\":",
    '- text_ilike | text_eq | text_starts_with: column = full_name|email|phone|source_channel|preferred_city|preferred_district|property_type_interest|property_notes; value string',
    '- text_in: column jako vyse, "values": [string, ...] (presna shoda, napr. vice kanalu)',
    '- is_null: column textovy nebo budget_min_czk|budget_max_czk',
    '- num_gte | num_lte | num_gt | num_lt | num_eq: column budget_min_czk|budget_max_czk; value number',
    '- ts_gte | ts_lte | ts_eq: column jen "created_at"; value ISO 8601 (UTC nebo offset)',
    '- id_eq: { "kind":"id_eq", "value": "<uuid>" }',
    "Pokud nefiltrujes strukturovane, nastav client_filters na null.",
    "",
    "filter_label: strucny cesky popis vystupu pro uzivatele; muze byt null.",
    "suggest_source_channel_chart:",
    "- true: dataset new_clients_q1 a smysl otazky opravdu potrebuje rozklad nebo srovnani podle zdroje/kanalu nebo vizualni trend po kategorii (sloupce, prehled odkud prisli) — i bez slova „graf“.",
    "- false: cisty seznam, export, jednotlive jmeno, textove zuzeni, nebo dataset neni new_clients_q1; NIKOLI jen proto, ze vete je slovo „tabulka“.",
    "- prezentace / PowerPoint / deck nad daty je jiny produkt — tady res jen databazovy vystup.",
    "",
    "suggest_derived_charts:",
    "- true jen pro dataset clients, kdy uzivatel chce graf / rozklad / podil / srovnani podle mesta, kanalu, typu nemovitosti, casove osy (mesice) apod. nad vytazenou tabulkou — backend z stejnych radku agreguje, bez dalsiho SQL.",
    "- false pro new_clients_q1, leads_vs_sales_6m, missing_reconstruction i kdyby v JSON omylem prislo true (ignoruje se mimo clients).",
    "",
    "derived_chart_kind_hint: jen pro clients a kdyz suggest_derived_charts true — volitelne \"bar\" | \"line\" | \"pie\" podle slov jako kolac/podil (pie), casova osa (line), jinak null."
  ].join("\n");

  const ask = async () =>
    generateWithAzureProxy({
      runId: params.runId,
      maxTokens: 420,
      trace: traceParams,
      messages: [
        { role: "system", content: system },
        { role: "user", content: params.question }
      ]
    });

  let llm = await ask();
  let parsed = tryParseJsonObject(DataPullPlanSchema, llm.text);
  if (parsed) return coercePlan(parsed);

  llm = await generateWithAzureProxy({
    runId: params.runId,
    maxTokens: 280,
    trace: traceParams
      ? { ...traceParams, name: "llm.data_pull.plan.repair" as const }
      : undefined,
    messages: [
      {
        role: "system",
        content:
          "Predchozi vystup nebyl validni JSON. Oprav na jediny JSON objekt: dataset, row_text_narrowing, client_filters (pole nebo null), filter_label, suggest_source_channel_chart, suggest_derived_charts, derived_chart_kind_hint (bar|line|pie nebo null)."
      },
      { role: "user", content: llm.text }
    ]
  });
  parsed = tryParseJsonObject(DataPullPlanSchema, llm.text);
  if (parsed) return coercePlan(parsed);

  return coercePlan(fallbackPlanFromQuestion(params.question));
}
