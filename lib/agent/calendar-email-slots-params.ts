/**
 * Odvodí horizont a počet slotů pro návrh prohlídek z přirozeného jazyka dotazu.
 */
export function inferViewingSlotParams(question: string): { daysAhead: number; limit: number } {
  const n = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  let daysAhead = 7;
  if (/\b14\s*d|\bctvrt|\bctyr|\bdvou?\s*tydn|\bdva\s*tydn/.test(n)) daysAhead = 14;
  if (/\b30\s*d|\bjeden\s*mesic|\bmesic(u|e)?\b/.test(n)) daysAhead = 30;

  const numDays = n.match(/\b(\d{1,2})\s*(dni|dny|dnu)\b/);
  if (numDays) {
    daysAhead = Math.min(30, Math.max(1, parseInt(numDays[1]!, 10)));
  }

  let limit = 5;
  if (/\b8\b|\bvice\b|\bvic\b|\bhodne\b|\bvice\s*termin/.test(n)) limit = 8;
  if (/\b3\s*termin|\btri\b|\bjen\s*3/.test(n)) limit = 3;

  return { daysAhead, limit };
}

/** První e-mailová adresa v textu (uživatel / kontext). */
export function extractEmailFromText(text: string): string | null {
  const m = text.match(/\b[A-Za-z0-9][\w.+-]*@[\w.-]+\.[A-Za-z]{2,}\b/);
  return m ? m[0]! : null;
}
