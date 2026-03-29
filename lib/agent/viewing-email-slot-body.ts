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

const VIEWING_CONFIRMED_SLOT_LABEL = /(?:Potvrzený termín prohlídky|Termín prohlídky):\s*([^\n]+)/;

/** Prefix měsíců — cs-CZ `month: "short"` (vč. bře/břez.). */
const CS_MONTHS: { pref: string; monthIndex: number }[] = [
  { pref: "led", monthIndex: 0 },
  { pref: "úno", monthIndex: 1 },
  { pref: "bre", monthIndex: 2 },
  { pref: "dub", monthIndex: 3 },
  { pref: "kve", monthIndex: 4 },
  { pref: "čvn", monthIndex: 5 },
  { pref: "čvc", monthIndex: 6 },
  { pref: "srp", monthIndex: 7 },
  { pref: "zář", monthIndex: 8 },
  { pref: "říj", monthIndex: 9 },
  { pref: "lis", monthIndex: 10 },
  { pref: "pro", monthIndex: 11 }
];

function stripDiacritics(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\./g, "");
}

function resolveMonthIndex(monToken: string): number {
  const n = stripDiacritics(monToken);
  for (const { pref, monthIndex } of CS_MONTHS) {
    const p = stripDiacritics(pref);
    if (n === p || n.startsWith(p) || p.startsWith(n.slice(0, Math.min(3, n.length)))) {
      return monthIndex;
    }
  }
  return -1;
}

function parseTimeParts(hhmm: string): { h: number; m: number } | null {
  const p = hhmm.split(":");
  if (p.length !== 2) return null;
  const h = parseInt(p[0]!, 10);
  const m = parseInt(p[1]!, 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return { h, m };
}

/**
 * Opak k {@link formatViewingSlotRange}: přečte uložený řádek z těla mailu (lidský cs-CZ text).
 * Volitelný hint rouh období náhledu kvůli roku u data bez roku v textu.
 */
export function parseViewingConfirmedSlotFromBody(
  body: string,
  hint?: { rangeStart: string; rangeEnd: string }
): { start: string; end: string } | null {
  const m = body.match(VIEWING_CONFIRMED_SLOT_LABEL);
  if (!m?.[1]) return null;
  const rest = m[1].trim();

  const timeM = rest.match(/(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})\s*$/);
  if (!timeM) return null;

  const datePart = rest.slice(0, rest.length - timeM[0].length).trim();
  /** Např. „po 15. bře.“ nebo „ne 15. 3.“ — odříznout volitelný den v týdnu před první číslicí. */
  const dateCore = datePart.replace(/^[^\d]+/, "").trim();

  let day: number;
  let month: number;
  const dmNum = dateCore.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*$/);
  const dmWord = dateCore.match(/^(\d{1,2})\.\s*([a-záíéěščřžýůúňďť]+)/iu);
  if (dmNum) {
    day = parseInt(dmNum[1]!, 10);
    const monthNum = parseInt(dmNum[2]!, 10);
    if (!Number.isFinite(day) || !Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return null;
    month = monthNum - 1;
  } else if (dmWord) {
    day = parseInt(dmWord[1]!, 10);
    const m = resolveMonthIndex(dmWord[2]!);
    if (!Number.isFinite(day) || m < 0) return null;
    month = m;
  } else {
    return null;
  }

  const t1 = parseTimeParts(timeM[1]!);
  const t2 = parseTimeParts(timeM[2]!);
  if (!t1 || !t2) return null;

  let year = new Date().getFullYear();
  if (hint) {
    const rs = new Date(hint.rangeStart).getTime();
    const re = new Date(hint.rangeEnd).getTime();
    if (!Number.isNaN(rs) && !Number.isNaN(re)) {
      year = new Date((rs + re) / 2).getFullYear();
    }
  }

  const build = (y: number) => {
    const start = new Date(y, month, day, t1.h, t1.m, 0, 0);
    const end = new Date(y, month, day, t2.h, t2.m, 0, 0);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() <= start.getTime()) {
      end.setDate(end.getDate() + 1);
    }
    return { start, end };
  };

  let { start, end } = build(year);
  if (hint) {
    const rs = new Date(hint.rangeStart).getTime();
    const re = new Date(hint.rangeEnd).getTime();
    if (!Number.isNaN(rs) && !Number.isNaN(re)) {
      const inside = start.getTime() >= rs - 86400000 && end.getTime() <= re + 86400000;
      if (!inside) {
        const b1 = build(year - 1);
        const b2 = build(year + 1);
        if (b1.start.getTime() >= rs - 86400000 && b1.end.getTime() <= re + 86400000) {
          start = b1.start;
          end = b1.end;
        } else if (b2.start.getTime() >= rs - 86400000 && b2.end.getTime() <= re + 86400000) {
          start = b2.start;
          end = b2.end;
        }
      }
    }
  }

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start: start.toISOString(), end: end.toISOString() };
}

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
