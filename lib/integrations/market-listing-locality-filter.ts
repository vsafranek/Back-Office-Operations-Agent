/**
 * Po stažení z portálů zúží nabídky podle čtvrti / města v textu hintu
 * (např. „Praha Holešovice“ → inzeráty s Holešovicemi / Prahou 7 v lokaci nebo titulku).
 * Obecný hint typu „Česko“ nebo „Praha“ bez konkrétní čtvrtě filtr neaplikuje.
 */
import type { MarketListing } from "@/lib/agent/tools/market-listing-model";
import { normCs } from "@/lib/integrations/cz-market-regions";

type LocalityRule = {
  /** Podřetězce v normCs(hint) — stačí jedna shoda pro aktivaci pravidla. */
  triggers: string[];
  /** Inzerát projde, pokud normCs(lokace + titul) obsahuje alespoň jednu z těchto variant (OR). */
  orNeedles: string[];
};

/** Pořadí: specifičtější triggery dřív (např. holesov před obecným „praha“ není v triggerech). */
const LOCALITY_RULES: LocalityRule[] = [
  { triggers: ["holesov"], orNeedles: ["holesovice", "praha 7"] },
  { triggers: ["karlin"], orNeedles: ["karlin", "praha 8"] },
  { triggers: ["smichov"], orNeedles: ["smichov", "praha 5"] },
  { triggers: ["vinohrad"], orNeedles: ["vinohrad", "praha 2", "praha 10"] },
  { triggers: ["dejvice"], orNeedles: ["dejvice", "praha 6"] },
  { triggers: ["zizkov"], orNeedles: ["zizkov", "praha 3"] },
  { triggers: ["vrsovice"], orNeedles: ["vrsovice", "praha 10"] },
  { triggers: ["liben"], orNeedles: ["liben", "praha 8", "praha 9"] },
  { triggers: ["chodov"], orNeedles: ["chodov", "praha 4"] },
  { triggers: ["repy"], orNeedles: ["repy", "praha 6"] },
  { triggers: ["stodulk"], orNeedles: ["stodulk", "praha 13"] },
  { triggers: ["letnan"], orNeedles: ["letnan", "praha 9", "praha 18"] },
  { triggers: ["modran"], orNeedles: ["modran", "praha 4"] },
  { triggers: ["cakovic"], orNeedles: ["cakovic", "praha 9"] },
  { triggers: ["vysocan"], orNeedles: ["vysocan", "praha 3", "praha 9"] },
  { triggers: ["hostivar"], orNeedles: ["hostivar", "praha 10"] },
  { triggers: ["jihlava"], orNeedles: ["jihlava"] },
  { triggers: ["brno"], orNeedles: ["brno"] },
  { triggers: ["ostrava"], orNeedles: ["ostrava"] }
];

function resolveOrNeedles(hint: string): string[] | null {
  const n = normCs(hint.trim());
  if (n.length < 3) return null;
  for (const rule of LOCALITY_RULES) {
    if (rule.triggers.some((t) => n.includes(t))) {
      return rule.orNeedles;
    }
  }
  return null;
}

/**
 * Tokeny pro vyhledávání uložených nálezů v `location_context` (+ volitelně pravidla čtvrtí jako u live filtru).
 * Spolu s ILIKE na title/location pokrývá různé formáty z portálů (lokalita v titulku, „Praha 7“, …).
 */
export function localityContextSearchTokens(hint: string): string[] {
  const raw = hint.trim();
  if (raw.length < 2) return [];
  const out = new Set<string>();
  const n = normCs(raw);
  if (n.length >= 2) out.add(n);
  const fromRules = resolveOrNeedles(raw);
  if (fromRules) {
    for (const x of fromRules) {
      if (x.length >= 2) out.add(x);
    }
  }
  return [...out];
}

function listingBlob(listing: MarketListing): string {
  return normCs(`${listing.location} ${listing.title}`);
}

/** true = inzerát odpovídá alespoň jedné variantě z OR. */
export function marketListingMatchesOrNeedles(listing: MarketListing, orNeedles: string[]): boolean {
  const blob = listingBlob(listing);
  return orNeedles.some((needle) => blob.includes(needle));
}

/**
 * Pokud hint obsahuje známou čtvrť/město, vrátí jen řádky s touto lokalitou v textu.
 * Když by filtr vyřadil všechny řádky, vrátí původní seznam (fallback) a volající může zalogovat.
 */
export function filterMarketListingsByLocalityHint(
  listings: MarketListing[],
  locationHint: string
): { listings: MarketListing[]; applied: boolean; orNeedles: string[] | null } {
  const orNeedles = resolveOrNeedles(locationHint);
  if (!orNeedles?.length) {
    return { listings, applied: false, orNeedles: null };
  }
  const filtered = listings.filter((l) => marketListingMatchesOrNeedles(l, orNeedles));
  if (filtered.length === 0 && listings.length > 0) {
    return { listings, applied: false, orNeedles };
  }
  return { listings: filtered, applied: true, orNeedles };
}
