import { FetchMarketListingsInputSchema } from "@/lib/agent/tools/market-listings-tool";
import { resolveCzMarketRegionFromText } from "@/lib/integrations/cz-market-regions";
import { extractCzPlaceHintForGeocode } from "@/lib/integrations/cz-place-hint";
import type { z } from "zod";

type FetchMarketListingsInput = z.infer<typeof FetchMarketListingsInputSchema>;

/** Oddělovač z `runBackOfficeAgent` u naplánovaných úloh — text před ním obsahuje systémový prefix („v infrastruktuře“ apod.). */
export const MARKET_LISTINGS_INFER_QUESTION_SLICE_MARKER = "--- Dotaz / šablona úlohy ---";

/**
 * Pro odhad fetch parametrů použije jen část za šablonou naplánované úlohy, aby regex lokality nebral text z prefixu.
 */
export function sliceQuestionForMarketListingInfer(question: string): string {
  const idx = question.indexOf(MARKET_LISTINGS_INFER_QUESTION_SLICE_MARKER);
  if (idx === -1) return question;
  return question.slice(idx + MARKET_LISTINGS_INFER_QUESTION_SLICE_MARKER.length).trimStart();
}

/**
 * Z přirozeného jazyka odvodí vstup pro fetchMarketListings (chatová větev bez LLM v args nástroje).
 */
export function inferMarketListingsInputFromQuestion(question: string): FetchMarketListingsInput {
  const q = sliceQuestionForMarketListingInfer(question).trim();
  const low = q.toLowerCase();

  const mentionsBez = /bezrealitk|bez\s*realit/i.test(low);
  const mentionsSre = /srealit|sreality/i.test(low);
  const onlyPhrase = /(jen|pouze|jenom|only|vyhradne|v\s*y\s*h\s*r\s*a\s*d\s*n\s*ě)\b/i.test(low);

  let sources: FetchMarketListingsInput["sources"];
  if (onlyPhrase && mentionsBez && !mentionsSre) {
    sources = ["bezrealitky"];
  } else if (onlyPhrase && mentionsSre && !mentionsBez) {
    sources = ["sreality"];
  } else if (mentionsBez && !mentionsSre) {
    sources = ["bezrealitky"];
  } else if (mentionsSre && !mentionsBez) {
    sources = ["sreality"];
  } else {
    sources = ["sreality", "bezrealitky"];
  }

  const rent =
    /pron\u00e1jmu|pron\u00e1jem|k\s+pron|n\u00e1jem|pronajem|rent\b|leasing/i.test(low) ||
    /\bpron\u00e1j/i.test(low);

  const bezrealitkyOfferType = rent ? "PRONAJEM" : "PRODEJ";
  const srealityOfferKind = rent ? "pronajem" : "prodej";

  const region = resolveCzMarketRegionFromText(q);
  const regionGeocodeHint = region ? undefined : extractCzPlaceHintForGeocode(q) ?? undefined;
  const listingLocationNeedle = region ? undefined : regionGeocodeHint;

  let location = "Česko";
  if (region) {
    location = region.label;
  } else if (!/st\u00e1hni|zaj\u00edm|dotaz|nab\u00edd/i.test(low) && q.length <= 72) {
    location = q;
  }

  return FetchMarketListingsInputSchema.parse({
    location,
    sources,
    bezrealitkyOfferType,
    srealityOfferKind,
    ...(regionGeocodeHint ? { regionGeocodeHint } : {}),
    ...(listingLocationNeedle ? { listingLocationNeedle } : {}),
    ...(region
      ? {
          bezrealitkyRegionOsmIds: [...region.bezrealitkyRegionOsmIds],
          bezrealitkyRegionLabel: region.label,
          srealityLocalityRegionId: region.srealityLocalityRegionId
        }
      : {})
  });
}
