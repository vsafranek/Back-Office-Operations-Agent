import { normCs } from "@/lib/integrations/cz-market-regions";

/** Fráze z systémových promptů („v infrastruktuře“), které regex „v …“ nesmí brát jako lokalitu. */
const PLACE_HINT_BLOCKLIST = new Set(
  ["infrastruktuře", "infrastrukture", "aplikaci", "aplikace", "backendu", "produkci"].map(normCs)
);

/**
 * Krátký úsek textu typu „v Hodoníně“ pro Nominatim (kraj z adresy), bez celé uživatelské věty.
 */
export function extractCzPlaceHintForGeocode(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const re = /\b(?:v|ve|u)\s+([^\s,;.?]+(?:\s+[^\s,;.?]+){0,2})/giu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const w = m[1]!.replace(/[,:;.?]+$/, "").trim();
    if (w.length < 2 || w.length > 64) continue;
    if (PLACE_HINT_BLOCKLIST.has(normCs(w))) continue;
    return w;
  }
  return null;
}
