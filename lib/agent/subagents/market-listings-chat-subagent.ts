import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";
import type { MarketListing } from "@/lib/agent/tools/market-listing-model";
import { inferMarketListingsInputFromQuestion } from "@/lib/agent/tools/market-listings-infer";
import { fetchMarketListings } from "@/lib/agent/tools/market-listings-tool";

const SUMMARY_LISTING_THRESHOLD = 12;

function listingToCard(l: MarketListing) {
  return {
    external_id: l.external_id,
    title: l.title,
    location: l.location,
    source: l.source,
    url: l.url,
    ...(l.image_url ? { image_url: l.image_url } : {})
  };
}

/**
 * Agent připraví fetchParams pro POST /api/market-listings; pravý panel si data dotáhne sám.
 * Jedno interní volání fetchMarketListings jen pro odhad textu (shrnutí vs. popis jednotlivých nabídek).
 */
export async function runMarketListingsChatSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  question: string;
}): Promise<AgentAnswer> {
  void params.toolRunner;

  const toolInput = inferMarketListingsInputFromQuestion(params.question);
  const listings = await fetchMarketListings(toolInput);

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
      : listings.length > SUMMARY_LISTING_THRESHOLD
        ? [
            `Dotaz uživatele: ${params.question}`,
            "Parametry (fetchParams) — stejné v pravém panelu po načtení:",
            JSON.stringify(toolInput, null, 2),
            `Počet nalezených nabídek: ${listings.length}.`,
            "Data jsou výhradně z Sreality / Bezrealitky (interní fetch).",
            "Úkol: napiš krátkou sumarizaci česky (2–4 krátké odstavce nebo odrážky): počet záznamů, jaké zdroje (sreality, bezrealitky) jsou v mixu, přibližný rozptyl cen nebo lokalit jen pokud je z ukázky zjevné.",
            "NEVYPISUJ celý seznam inzerátů — uživatel je vidí v panelu vpravo jako karty.",
            `První 3 titulky pro kontext: ${listings
              .slice(0, 3)
              .map((l) => l.title)
              .join(" · ")}`
          ].join("\n\n")
        : [
            `Dotaz uživatele: ${params.question}`,
            "Parametry:",
            JSON.stringify(toolInput, null, 2),
            `Nalezeno ${listings.length} nabídek (málo — popiš je jednotlivě stručně).`,
            "Data výhradně z interního API (Sreality/Bezrealitky).",
            "Úkol česky: ke každé nabídce 1–2 věty (lokalita, zdroj). Odkaz do textu nedávej — je v panelu.",
            JSON.stringify(listings, null, 2)
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
    userContent
  });

  const artifactContent =
    listings.length > 40
      ? JSON.stringify(
          {
            count: listings.length,
            fetchParams: toolInput,
            sample: listings.slice(0, 5).map(listingToCard)
          },
          null,
          2
        )
      : JSON.stringify(listings, null, 2);

  return {
    answer_text: reply.answer_text,
    confidence: reply.confidence,
    sources: citations,
    generated_artifacts: [
      {
        type: "report",
        label: "Market listings (metadata)",
        content: artifactContent
      }
    ],
    next_actions: reply.next_actions,
    dataPanel: {
      kind: "market_listings",
      title: "Nabídky na trhu",
      fetchParams: { ...toolInput } as Record<string, unknown>,
      listings: []
    }
  };
}
