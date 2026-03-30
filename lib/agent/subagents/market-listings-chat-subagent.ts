import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";
import type { MarketListing } from "@/lib/agent/tools/market-listing-model";
import { inferMarketListingsInputFromQuestion } from "@/lib/agent/tools/market-listings-infer";
import { fetchMarketListings } from "@/lib/agent/tools/market-listings-tool";
import { recordUserMarketListingFinds } from "@/lib/market-listings/record-user-market-listing-finds";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

const SUMMARY_LISTING_THRESHOLD = 12;
const MAX_DETAIL_ITEMS = 25;
const EXISTING_IDS_BATCH = 200;

function listingToCard(l: MarketListing) {
  return {
    external_id: l.external_id,
    title: l.title,
    location: l.location,
    source: l.source,
    url: l.url,
    ...(l.image_url ? { image_url: l.image_url } : {}),
    ...(l.price_czk != null ? { price_czk: l.price_czk } : {})
  };
}

async function selectExistingListingIdsForUser(userId: string, externalIds: string[]): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set<string>();
  try {
    const supabase = getSupabaseAdminClient();
    const existing = new Set<string>();
    for (let i = 0; i < externalIds.length; i += EXISTING_IDS_BATCH) {
      const chunk = externalIds.slice(i, i + EXISTING_IDS_BATCH);
      const { data, error } = await supabase
        .from("user_market_listing_finds")
        .select("external_id")
        .eq("user_id", userId)
        .in("external_id", chunk);
      if (error) throw error;
      for (const row of data ?? []) {
        if (typeof row.external_id === "string" && row.external_id.trim().length > 0) {
          existing.add(row.external_id);
        }
      }
    }
    return existing;
  } catch {
    // If lookup fails (e.g. local env/cert issue), fail open and keep UX functional.
    return new Set<string>();
  }
}

/**
 * Agent připraví fetchParams pro POST /api/market-listings; pravý panel si data dotáhne sám.
 * Jedno interní volání fetchMarketListings jen pro odhad textu (shrnutí vs. popis jednotlivých nabídek).
 */
export async function runMarketListingsChatSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  question: string;
  onAnswerDelta?: (chunk: string) => void | Promise<void>;
}): Promise<AgentAnswer> {
  void params.toolRunner;

  const toolInput = inferMarketListingsInputFromQuestion(params.question);
  const listings = await fetchMarketListings(toolInput);
  const existingIds = await selectExistingListingIdsForUser(
    params.ctx.userId,
    listings.map((l) => l.external_id).filter(Boolean)
  );
  const newListings = listings.filter((l) => !existingIds.has(l.external_id));

  void recordUserMarketListingFinds({
    userId: params.ctx.userId,
    agentRunId: params.ctx.runId ?? null,
    listings
  }).catch(() => {});

  const citations = Array.from(new Set(listings.map((l) => l.url).filter(Boolean)));

  const userContent =
    listings.length === 0
      ? [
          `Dotaz uživatele: ${params.question}`,
          "Parametry vyhledávání (fetchParams pro API):",
          JSON.stringify(toolInput, null, 2),
          "Nelze načíst žádné nabídky (API vrátilo prázdný seznam). Stručně vysvětli česky (např. filtry, dostupnost API, env Bezrealitky).",
          "Neuváděj DuckDuckGo. Karty zůstanou prázdné, dokud API nic nevrátí."
        ].join("\n\n")
      : newListings.length === 0
        ? [
            `Dotaz uživatele: ${params.question}`,
            "Parametry vyhledávání (fetchParams):",
            JSON.stringify(toolInput, null, 2),
            `Načteno ${listings.length} nabídek, ale po porovnání s DB nejsou žádné nové inzeráty.`,
            "Úkol: odpověz česky stručně (2-4 věty), že nebyly nalezeny nové nabídky, a doporuč upřesnit filtry (lokalita, cena, dispozice)."
          ].join("\n\n")
        : newListings.length > SUMMARY_LISTING_THRESHOLD
        ? [
            `Dotaz uživatele: ${params.question}`,
            "Parametry (fetchParams) — stejné v pravém panelu po načtení:",
            JSON.stringify(toolInput, null, 2),
            `Počet nalezených nabídek: ${listings.length}.`,
            `Počet NOVÝCH proti databázi uživatele: ${newListings.length}.`,
            "Data jsou výhradně z Sreality / Bezrealitky (interní fetch).",
            "Úkol: napiš česky stručnou sumarizaci + krátký výpis prvních nových inzerátů (max 10 položek, odrážky: název, lokalita, cena pokud je).",
            `První 5 NOVÝCH titulků pro kontext: ${newListings
              .slice(0, 3)
              .map((l) => l.title)
              .join(" · ")}`
          ].join("\n\n")
        : [
            `Dotaz uživatele: ${params.question}`,
            "Parametry:",
            JSON.stringify(toolInput, null, 2),
            `Nalezeno ${listings.length} nabídek, z toho ${newListings.length} nových proti DB uživatele.`,
            "Data výhradně z interního API (Sreality/Bezrealitky).",
            "Úkol česky: vypiš jednotlivě nové nabídky (max 25), stručně po bodech. Odkazy v textu neuváděj.",
            JSON.stringify(newListings.slice(0, MAX_DETAIL_ITEMS), null, 2)
          ].join("\n\n");

  const reply = await generateUserFacingReply({
    runId: params.ctx.runId,
    maxTokens: listings.length > SUMMARY_LISTING_THRESHOLD ? 900 : 1600,
    trace: params.ctx.trace
      ? {
          recorder: params.ctx.trace,
          parentId: params.ctx.traceParentId ?? null,
          name: "llm.subagent.market-listings.reply"
        }
      : undefined,
    onAnswerDelta: params.onAnswerDelta,
    userContent
  });

  return {
    answer_text: reply.answer_text,
    confidence: reply.confidence,
    sources: citations,
    generated_artifacts: [],
    next_actions: reply.next_actions,
    dataPanel: {
      kind: "market_listings",
      title:
        newListings.length > 0
          ? `Nové nabídky (${newListings.length})`
          : `Nové nabídky (0)`,
      listings: newListings.map(listingToCard)
    }
  };
}
