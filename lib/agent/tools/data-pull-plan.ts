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

export const DataPullPlanSchema = z.object({
  dataset: z.enum(DATASET_IDS),
  row_text_narrowing: z.string().max(160).nullable().optional(),
  /** Strukturované filtry tabulky `clients` (whitelist sloupců v ClientFilterSchema). */
  client_filters: ClientFiltersSchema.nullable().optional(),
  filter_label: z.string().max(220).nullable().optional(),
  suggest_source_channel_chart: z.boolean().optional()
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

/** Zúžení již načtených řádků (views) podle volného textu — bez nových SQL presetů. */
export function narrowRowsByText(rows: Record<string, unknown>[], term: string): Record<string, unknown>[] {
  const t = normalizeAsciiForSearch(term.trim());
  if (!t) return rows;
  return rows.filter((row) =>
    ROW_TEXT_COLUMNS.some((c) => {
      const v = row[c];
      return typeof v === "string" && normalizeAsciiForSearch(v).includes(t);
    })
  );
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
export function fallbackPlanFromQuestion(question: string): DataPullPlan {
  const n = normalizeAsciiForSearch(question);

  if (n.includes("rekonstruk")) {
    return {
      dataset: "missing_reconstruction",
      row_text_narrowing: null,
      client_filters: null,
      filter_label: "Klienti — chybějící údaje k rekonstrukci",
      suggest_source_channel_chart: false
    };
  }

  if ((n.includes("lead") || n.includes("prodej") || n.includes("prodan")) && n.includes("mesic")) {
    return {
      dataset: "leads_vs_sales_6m",
      row_text_narrowing: null,
      client_filters: null,
      filter_label: null,
      suggest_source_channel_chart: false
    };
  }

  const mentionsClient = n.includes("klient") || n.includes("zakaznik") || n.includes("zakaznici");

  const areaTerm = extractClientAreaSearchTerm(question);
  if (mentionsClient && areaTerm) {
    return {
      dataset: "clients",
      row_text_narrowing: areaTerm,
      client_filters: null,
      filter_label: `Klienti — shoda v oblasti / městě / poznámkách („${areaTerm}“)`,
      suggest_source_channel_chart: false
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

  const wantsQ1NewClients =
    mentionsClient &&
    (mentionsQuarter || mentionsAcquisition || wantsChartNotDeck || (n.includes("nov") && mentionsQuarter));

  if (wantsQ1NewClients) {
    return {
      dataset: "new_clients_q1",
      row_text_narrowing: null,
      client_filters: null,
      filter_label: "Noví klienti — Q1 (view)",
      suggest_source_channel_chart: true
    };
  }

  if (mentionsClient) {
    return {
      dataset: "clients",
      row_text_narrowing: null,
      client_filters: null,
      filter_label: "Klienti (tabulka)",
      suggest_source_channel_chart: false
    };
  }

  return {
    dataset: "new_clients_q1",
    row_text_narrowing: null,
    client_filters: null,
    filter_label: "Noví klienti — Q1 (view)",
    suggest_source_channel_chart: true
  };
}

function coercePlan(raw: DataPullPlan): DataPullPlan {
  const cf = raw.client_filters?.length ? raw.client_filters.slice(0, 15) : null;
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
        : false
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
    "Navrhni jeden interni dotaz nad daty v aplikaci. Vrat POUZE jeden JSON objekt (bez markdownu).",
    "Povinne klice: dataset, row_text_narrowing (string|null), client_filters (pole|null), filter_label (string|null), suggest_source_channel_chart (boolean).",
    "",
    'dataset: presne jedna z retezcu: "new_clients_q1" | "leads_vs_sales_6m" | "clients" | "missing_reconstruction".',
    "",
    "Dostupne datasety:",
    "- new_clients_q1: novi klienti v 1. kvartalu aktualniho roku (view ma source_channel).",
    "- leads_vs_sales_6m: leady vs prodane byty za 6 mesicu.",
    "- clients: tabulka clients v DB — pro obecne dotazy na klienty, filtry, budget, kanal.",
    "- missing_reconstruction: klienti s chybejicimi poznamkami k rekonstrukci.",
    "",
    "row_text_narrowing: jednoduche OR vyhledani v preferred_district, preferred_city, property_notes (napr. Dejvice). null pokud pouzivas jen client_filters nebo zadny text.",
    "",
    "client_filters: pole az 15 podminek pro dataset clients — kazda polozka ma \"kind\" a dalsi pole:",
    '- text_ilike: { "kind":"text_ilike", "column": <full_name|email|phone|source_channel|preferred_city|preferred_district|property_type_interest|property_notes>, "value": string }',
    '- text_eq: { "kind":"text_eq", "column": <stejne jako vyse>, "value": string }',
    '- is_null: { "kind":"is_null", "column": <textovy nebo budget_min_czk|budget_max_czk> }',
    '- num_gte | num_lte | num_eq: { "kind":"num_gte", "column": budget_min_czk|budget_max_czk, "value": number }',
    "Pokud nefiltrujes strukturovane, nastav client_filters na null.",
    "",
    "filter_label: strucny cesky popis vystupu pro uzivatele; muze byt null.",
    "suggest_source_channel_chart: true jen kdyz dataset je new_clients_q1 a smysl ma graf podle zdroje (kanalu); jinak false."
  ].join("\n");

  const ask = async () =>
    generateWithAzureProxy({
      runId: params.runId,
      maxTokens: 320,
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
          "Predchozi vystup nebyl validni JSON. Oprav na jediny JSON objekt: dataset, row_text_narrowing, client_filters (pole nebo null), filter_label, suggest_source_channel_chart."
      },
      { role: "user", content: llm.text }
    ]
  });
  parsed = tryParseJsonObject(DataPullPlanSchema, llm.text);
  if (parsed) return coercePlan(parsed);

  return coercePlan(fallbackPlanFromQuestion(params.question));
}
