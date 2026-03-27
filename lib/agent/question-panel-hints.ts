/** Normalizace pro jednoduché klíčové slovo heuristiky v češtině. */
function normCz(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

/**
 * Uživatel explicitně nechce graf — stačí tabulka (pravý panel skryje graf, data zůstanou).
 */
export function shouldSuppressChartInPanel(question: string): boolean {
  const n = normCz(question);
  if (/\bbez\s+graf/.test(n)) return true;
  if (/\bjen\s+tabulk/.test(n)) return true;
  if (/\bpouze\s+tabulk/.test(n)) return true;
  if (/\btabulka\s+jen\b/.test(n)) return true;
  return false;
}

/**
 * Uživatel explicitně žádá graf (slouží jako slabší signál — data bez vizualizace ho stejně často dávají smysl).
 */
export function userMentionsChartRequest(question: string): boolean {
  const n = normCz(question);
  if (/\bgraf/.test(n)) return true;
  if (/\bgrafic/.test(n)) return true;
  if (/\bvykresli\b/.test(n)) return true;
  if (/\bznazorn/.test(n)) return true;
  if (/\bvytvor\s+graf/.test(n)) return true;
  if (/\bsloupcovy|\bsloupove\b/.test(n)) return true;
  if (/\bdiagram/.test(n)) return true;
  return false;
}
