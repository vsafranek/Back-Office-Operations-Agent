import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import type { ReportExtraSheet } from "@/lib/agent/tools/report-tool";

const DEFAULT_LIMIT = 2000;

/** Dotáhne portfolio, leady a obchody pro doplňkové listy v Excelu (service role). */
export async function fetchCrmSheetsForReport(maxRows = DEFAULT_LIMIT): Promise<ReportExtraSheet[]> {
  const supabase = getSupabaseAdminClient();

  const [propsRes, leadsRes, dealsRes] = await Promise.all([
    supabase.from("properties").select("*").order("created_at", { ascending: false }).limit(maxRows),
    supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(maxRows),
    supabase.from("deals").select("*").order("sold_at", { ascending: false, nullsFirst: false }).limit(maxRows)
  ]);

  if (propsRes.error) {
    throw new Error(`Načtení properties pro Excel selhalo: ${propsRes.error.message}`);
  }
  if (leadsRes.error) {
    throw new Error(`Načtení leads pro Excel selhalo: ${leadsRes.error.message}`);
  }
  if (dealsRes.error) {
    throw new Error(`Načtení deals pro Excel selhalo: ${dealsRes.error.message}`);
  }

  const properties = (propsRes.data ?? []) as Record<string, unknown>[];
  const leads = (leadsRes.data ?? []) as Record<string, unknown>[];
  const deals = (dealsRes.data ?? []) as Record<string, unknown>[];

  return [
    { name: "Properties", rows: properties },
    { name: "Leads", rows: leads },
    { name: "Deals", rows: deals }
  ];
}

/**
 * Heuristika: uživatel chce Excel nebo výpis portfolia / nemovitostí vedle hlavního datasetu.
 */
export function shouldAttachCrmPortfolioSheets(question: string): boolean {
  const n = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");

  if (/\bexcel\b|xlsx|\bxls\b/.test(n)) return true;
  if (/portfolio|nemovitost|nemovitosti/.test(n)) return true;
  if (/export|exportovat|stahnout|ulozit|uložit/.test(n) && (n.includes("lead") || n.includes("nemovit"))) return true;
  if (
    /\bdeal\b|obchod|obchody|provize|provizi|uzavren|uzavřen|prodej|crm|pipeline/.test(n)
  ) {
    return true;
  }
  return false;
}
