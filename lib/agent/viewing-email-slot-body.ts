/** Sdílená logika řádku s termínem prohlídky v těle mailu (chat + panel). */

export function formatViewingSlotRange(startIso: string, endIso: string): string {
  try {
    const s = new Date(startIso);
    const e = new Date(endIso);
    if (Number.isNaN(s.getTime())) return startIso;
    const d = s.toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "short" });
    const t1 = s.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
    const t2 = e.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
    return `${d} ${t1}–${t2}`;
  } catch {
    return `${startIso} – ${endIso}`;
  }
}

/** Odstraní aktuální i dřívější znění řádku (migrace z „Potvrzený termín…“). */
export const VIEWING_CONFIRMED_SLOT_LINE =
  /\n\n(?:Potvrzený termín prohlídky|Termín prohlídky):\s*[^\n]+/;

export function applyViewingConfirmedSlotToBody(
  body: string,
  slot: { start: string; end: string } | null,
  fmt: (startIso: string, endIso: string) => string = formatViewingSlotRange
): string {
  let b = body.replace(VIEWING_CONFIRMED_SLOT_LINE, "");
  const signIdx = b.search(/\nS pozdravem,/);
  if (!slot) {
    return b;
  }
  const line = `\n\nTermín prohlídky: ${fmt(slot.start, slot.end)}`;
  if (signIdx >= 0) {
    return b.slice(0, signIdx) + line + b.slice(signIdx);
  }
  return b + line;
}
