export type ViewingSlotInference = {
  daysAhead: number;
  limit: number;
  /** Délka jedné schůzky / prohlídky v minutách (15–480, krok 15). */
  slotDurationMinutes: number;
};

function clampSteppedMinutes(m: number): number {
  const stepped = Math.round(m / 15) * 15;
  return Math.max(15, Math.min(480, stepped));
}

/**
 * Odvodí horizont, počet slotů a délku schůzky pro návrh prohlídek z přirozeného jazyka dotazu.
 */
export function inferViewingSlotParams(question: string): ViewingSlotInference {
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

  let slotDurationMinutes = 60;
  if (
    /\b90\s*min/.test(n) ||
    /\b90\b.*\bminut/.test(n) ||
    /hodin(u|y)?\s+a\s+pol|hodinu\s+a\s+pul|hodiny\s+a\s+pul|anapul|90\s*minut|hod\s*a\s*pol/.test(n)
  ) {
    slotDurationMinutes = 90;
  } else if (/\b75\s*min/.test(n) || /\b75\b.*\bminut/.test(n)) {
    slotDurationMinutes = 75;
  } else if (/\b45\s*min/.test(n) || /\b45\b.*\bminut/.test(n) || /45\s*minut/.test(n)) {
    slotDurationMinutes = 45;
  } else if (/\b30\s*min/.test(n) || /\b30\b.*\bminut/.test(n) || /\bpul\s*hodin(u|y)?\b/.test(n) || /\b30\s*minut/.test(n)) {
    slotDurationMinutes = 30;
  } else if (/\b15\s*min/.test(n) || /\b15\b.*\bminut/.test(n) || /\bctvrt\s*hodin(u|y)?\b/.test(n) || /\b15\s*minut/.test(n)) {
    slotDurationMinutes = 15;
  } else if (
    /\b120\s*min/.test(n) ||
    /\b120\b.*\bminut/.test(n) ||
    /\b2\s*hodin(y|u)\b/.test(n) ||
    /\bdve\s*hodin/.test(n) ||
    /\b2\s*h\.\b/.test(n)
  ) {
    slotDurationMinutes = 120;
  } else if (/\b(\d{1,3})\s*minut(u|y)?\b/.test(n)) {
    const m = n.match(/\b(\d{1,3})\s*minut(u|y)?\b/);
    if (m) slotDurationMinutes = parseInt(m[1]!, 10);
  }

  slotDurationMinutes = clampSteppedMinutes(slotDurationMinutes);

  return { daysAhead, limit, slotDurationMinutes };
}

/** První e-mailová adresa v textu (uživatel / kontext). */
export function extractEmailFromText(text: string): string | null {
  const m = text.match(/\b[A-Za-z0-9][\w.+-]*@[\w.-]+\.[A-Za-z]{2,}\b/);
  return m ? m[0]! : null;
}
