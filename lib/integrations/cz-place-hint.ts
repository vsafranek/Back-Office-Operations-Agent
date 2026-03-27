/**
 * Krátký úsek textu typu „v Hodoníně“ pro Nominatim (kraj z adresy), bez celé uživatelské věty.
 */
export function extractCzPlaceHintForGeocode(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/\b(?:v|ve|u)\s+([^\s,;.?]+(?:\s+[^\s,;.?]+){0,2})/iu);
  if (!m?.[1]) return null;
  const w = m[1].replace(/[,:;.?]+$/, "").trim();
  if (w.length < 2 || w.length > 64) return null;
  return w;
}
