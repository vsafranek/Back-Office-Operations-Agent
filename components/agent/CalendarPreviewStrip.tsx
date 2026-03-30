"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

type Block = { start: string; end: string };

type TimeSlot = { hour: number; minute: number };

type Props = {
  busy: Block[];
  proposedSlots: Block[];
  rangeStart: string;
  rangeEnd: string;
  durationMs?: number;
  onSlotPick?: (startIso: string, endIso: string) => void;
  selectedSlot?: Block | null;
  /** Oddělení zvýraznění: návrh z radií vs. vlastní klik do volna. */
  selectedSource?: "agent" | "manual" | null;
  /**
   * Bez interaktivního výběru: označí volná pole, kde by délka schůzky kolidovala s busy (náhled „nelze začít“).
   */
  previewDurationCollisions?: boolean;
  navigateEarlierLabel?: string;
  navigateLaterLabel?: string;
  onNavigateEarlier?: () => void;
  onNavigateLater?: () => void;
  canNavigateEarlier?: boolean;
  canNavigateLater?: boolean;
  pageLabelOverride?: string;
};

const VIEW_START_MIN = 8 * 60;
const VIEW_END_MIN = 18 * 60;
const DAYS_PER_PAGE = 7;
const MAX_RANGE_DAYS = 42;

function buildTimeSlots(): TimeSlot[] {
  const out: TimeSlot[] = [];
  for (let m = VIEW_START_MIN; m < VIEW_END_MIN; m += 30) {
    out.push({ hour: Math.floor(m / 60), minute: m % 60 });
  }
  return out;
}

const TIME_SLOTS = buildTimeSlots();

function overlap(a0: Date, a1: Date, b0: Date, b1: Date): boolean {
  return a0 < b1 && a1 > b0;
}

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function cellWindow(day: Date, hour: number, minute: number): { start: Date; end: Date } {
  const a0 = new Date(day);
  a0.setHours(hour, minute, 0, 0);
  const a1 = new Date(a0.getTime() + 30 * 60 * 1000);
  return { start: a0, end: a1 };
}

function formatSlotTooltip(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  return `${s.toLocaleString("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })} → ${e.toLocaleString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`;
}

function cellKind(
  day: Date,
  slot: TimeSlot,
  busy: Block[],
  proposed: Block[]
): "proposed" | "busy" | "free" {
  const { start: a0, end: a1 } = cellWindow(day, slot.hour, slot.minute);
  for (const p of proposed) {
    const b0 = new Date(p.start);
    const b1 = new Date(p.end);
    if (!Number.isNaN(b0.getTime()) && !Number.isNaN(b1.getTime()) && overlap(a0, a1, b0, b1)) {
      return "proposed";
    }
  }
  for (const b of busy) {
    const b0 = new Date(b.start);
    const b1 = new Date(b.end);
    if (!Number.isNaN(b0.getTime()) && !Number.isNaN(b1.getTime()) && overlap(a0, a1, b0, b1)) {
      return "busy";
    }
  }
  return "free";
}

function proposedSlotForCell(day: Date, slot: TimeSlot, proposed: Block[]): Block | null {
  const { start: a0, end: a1 } = cellWindow(day, slot.hour, slot.minute);
  const matches = proposed.filter((p) => {
    const b0 = new Date(p.start);
    const b1 = new Date(p.end);
    return !Number.isNaN(b0.getTime()) && !Number.isNaN(b1.getTime()) && overlap(a0, a1, b0, b1);
  });
  return matches[0] ?? null;
}

function intervalOverlapsBusy(start: Date, end: Date, busy: Block[]): boolean {
  for (const b of busy) {
    const b0 = new Date(b.start);
    const b1 = new Date(b.end);
    if (!Number.isNaN(b0.getTime()) && !Number.isNaN(b1.getTime()) && overlap(start, end, b0, b1)) {
      return true;
    }
  }
  return false;
}

function cellSelected(day: Date, slot: TimeSlot, sel: Block | null | undefined): boolean {
  if (!sel) return false;
  const { start: a0, end: a1 } = cellWindow(day, slot.hour, slot.minute);
  const s0 = new Date(sel.start);
  const s1 = new Date(sel.end);
  if (Number.isNaN(s0.getTime()) || Number.isNaN(s1.getTime())) return false;
  return overlap(a0, a1, s0, s1);
}

function slotLabel(slot: TimeSlot): string {
  return `${slot.hour}:${String(slot.minute).padStart(2, "0")}`;
}

const DEFAULT_DURATION_MS = 60 * 60 * 1000;

function isFreeStartInvalid(
  day: Date,
  slot: TimeSlot,
  durationMs: number,
  busy: Block[],
  rs: number,
  re: number
): boolean {
  const start = new Date(day);
  start.setHours(slot.hour, slot.minute, 0, 0);
  const end = new Date(start.getTime() + durationMs);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true;
  if (start.getTime() < rs || end.getTime() > re) return true;
  return intervalOverlapsBusy(start, end, busy);
}

/**
 * Náhled kalendáře: 30min buňky 8:00–18:00, návrhy / busy / volno; volitelná interakce a stránkování týdnů.
 */
export function CalendarPreviewStrip({
  busy,
  proposedSlots,
  rangeStart,
  rangeEnd,
  durationMs = DEFAULT_DURATION_MS,
  onSlotPick,
  selectedSlot = null,
  selectedSource = null,
  previewDurationCollisions = false,
  navigateEarlierLabel = "← Dříve",
  navigateLaterLabel = "Později →",
  onNavigateEarlier,
  onNavigateLater,
  canNavigateEarlier,
  canNavigateLater,
  pageLabelOverride
}: Props) {
  const interactive = typeof onSlotPick === "function";
  const showDurationRules = interactive || previewDurationCollisions;
  const [pageStart, setPageStart] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const allDays = useMemo(() => {
    const days: Date[] = [];
    const cur = dayStart(new Date(rangeStart));
    const endD = dayStart(new Date(rangeEnd));
    if (Number.isNaN(cur.getTime()) || Number.isNaN(endD.getTime())) return days;
    let n = 0;
    while (cur <= endD && n < MAX_RANGE_DAYS) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
      n += 1;
    }
    return days;
  }, [rangeStart, rangeEnd]);

  const pageMaxStart = Math.max(0, allDays.length - DAYS_PER_PAGE);

  useEffect(() => {
    setPageStart(0);
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    setPageStart((p) => Math.min(p, pageMaxStart));
  }, [pageMaxStart]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const safePageStart = Math.min(pageStart, pageMaxStart);
  const days = allDays.slice(safePageStart, safePageStart + DAYS_PER_PAGE);

  const rs = new Date(rangeStart).getTime();
  const re = new Date(rangeEnd).getTime();

  const now = useMemo(() => new Date(nowTick), [nowTick]);
  const todayInViewIdx = days.findIndex((d) => sameLocalDay(d, now));
  let nowLineLeftPct: number | null = null;
  if (todayInViewIdx >= 0) {
    const mins = now.getHours() * 60 + now.getMinutes();
    if (mins >= VIEW_START_MIN && mins < VIEW_END_MIN) {
      nowLineLeftPct = (mins - VIEW_START_MIN) / (VIEW_END_MIN - VIEW_START_MIN);
    }
  }

  function handleCellActivate(day: Date, slot: TimeSlot, kind: "proposed" | "busy" | "free", freeBlocked: boolean) {
    if (!interactive || !onSlotPick) return;
    if (kind === "busy" || freeBlocked) return;

    if (kind === "proposed") {
      const block = proposedSlotForCell(day, slot, proposedSlots);
      if (!block) return;
      const blockStart = new Date(block.start);
      const blockEnd = new Date(block.end);
      if (Number.isNaN(blockStart.getTime()) || Number.isNaN(blockEnd.getTime())) return;
      const clickStart = new Date(day);
      clickStart.setHours(slot.hour, slot.minute, 0, 0);
      if (clickStart.getTime() < blockStart.getTime() || clickStart.getTime() >= blockEnd.getTime()) return;
      const endAtDuration = new Date(clickStart.getTime() + durationMs);
      if (clickStart.getTime() < rs || endAtDuration.getTime() > re) return;
      if (intervalOverlapsBusy(clickStart, endAtDuration, busy)) return;
      onSlotPick(clickStart.toISOString(), endAtDuration.toISOString());
      return;
    }

    const start = new Date(day);
    start.setHours(slot.hour, slot.minute, 0, 0);
    const end = new Date(start.getTime() + durationMs);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    if (start.getTime() < rs || end.getTime() > re) return;
    if (intervalOverlapsBusy(start, end, busy)) return;
    onSlotPick(start.toISOString(), end.toISOString());
  }

  const selectedAccent =
    selectedSource === "manual" ? "#7c3aed" : selectedSource === "agent" ? "#047857" : "#4f46e5";

  const colTemplate = `52px repeat(${days.length}, minmax(0, 1fr))`;

  const cellBase = (kind: "proposed" | "busy" | "free", freeBlocked: boolean): CSSProperties => {
    if (freeBlocked && interactive) {
      return {
        borderRadius: 3,
        background: "repeating-linear-gradient(-45deg, #e2e8f0, #e2e8f0 3px, #f1f5f9 3px, #f1f5f9 6px)",
        border: "1px solid #cbd5e1",
        minHeight: 11,
        width: "100%",
        height: "100%",
        padding: 0,
        margin: 0,
        cursor: "not-allowed",
        display: "block",
        boxSizing: "border-box",
        opacity: 0.9
      };
    }
    const bg =
      kind === "proposed"
        ? "linear-gradient(180deg,#34d399,#10b981)"
        : kind === "busy"
          ? "#94a3b8"
          : "#f1f5f9";
    const border =
      kind === "proposed" ? "1px solid #047857" : kind === "busy" ? "1px solid #64748b" : "1px solid #e2e8f0";
    return {
      borderRadius: 3,
      background: bg,
      border,
      minHeight: 11,
      width: "100%",
      height: "100%",
      padding: 0,
      margin: 0,
      cursor: interactive && kind !== "busy" ? "pointer" : "default",
      display: "block",
      boxSizing: "border-box" as const
    };
  };

  if (allDays.length === 0) {
    return <p style={{ fontSize: 13, color: "#64748b" }}>Nelze vykreslit náhled kalendáře (neplatné rozmezí).</p>;
  }

  const externalPaging = typeof onNavigateEarlier === "function" && typeof onNavigateLater === "function";
  const pager =
    allDays.length > DAYS_PER_PAGE ? (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          fontSize: 12,
          color: "#475569"
        }}
      >
        <button
          type="button"
          disabled={externalPaging ? canNavigateEarlier === false : safePageStart <= 0}
          onClick={() =>
            externalPaging ? onNavigateEarlier() : setPageStart((p) => Math.max(0, p - DAYS_PER_PAGE))
          }
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #cbd5e1",
            background: (externalPaging ? canNavigateEarlier === false : safePageStart <= 0) ? "#f1f5f9" : "#fff",
            cursor: (externalPaging ? canNavigateEarlier === false : safePageStart <= 0) ? "default" : "pointer",
            fontSize: 12
          }}
        >
          {navigateEarlierLabel}
        </button>
        <span>
          {pageLabelOverride ??
            `${days[0]?.toLocaleDateString("cs-CZ", { day: "numeric", month: "short" })} – ${days[days.length - 1]?.toLocaleDateString("cs-CZ", {
              day: "numeric",
              month: "short",
              year: "numeric"
            })} · celkem ${allDays.length} dní`}
        </span>
        <button
          type="button"
          disabled={externalPaging ? canNavigateLater === false : safePageStart >= pageMaxStart}
          onClick={() =>
            externalPaging ? onNavigateLater() : setPageStart((p) => Math.min(pageMaxStart, p + DAYS_PER_PAGE))
          }
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #cbd5e1",
            background: (externalPaging ? canNavigateLater === false : safePageStart >= pageMaxStart) ? "#f1f5f9" : "#fff",
            cursor: (externalPaging ? canNavigateLater === false : safePageStart >= pageMaxStart) ? "default" : "pointer",
            fontSize: 12
          }}
        >
          {navigateLaterLabel}
        </button>
      </div>
    ) : null;

  const nowOverlay: ReactNode =
    todayInViewIdx >= 0 && nowLineLeftPct != null ? (
      <div
        key="now-line"
        style={{
          gridColumn: todayInViewIdx + 2,
          gridRow: `2 / ${2 + TIME_SLOTS.length}`,
          position: "relative",
          pointerEvents: "none",
          zIndex: 4,
          minHeight: 0,
          margin: "0 -1px"
        }}
      >
        <div
          title={`Nyní — ${now.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`}
          style={{
            position: "absolute",
            left: `calc(${nowLineLeftPct * 100}% - 1px)`,
            top: 0,
            bottom: 0,
            width: 2,
            background: "rgba(239, 68, 68, 0.92)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.75)",
            borderRadius: 1
          }}
        />
      </div>
    ) : null;

  return (
    <div style={{ overflowX: "auto" }}>
      {pager}
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: colTemplate,
          gridTemplateRows: `auto repeat(${TIME_SLOTS.length}, minmax(14px, 14px))`,
          gridAutoFlow: "row",
          gap: 2,
          fontSize: 10,
          minWidth: Math.max(280, 52 + days.length * 36),
          alignItems: "stretch"
        }}
      >
        <div style={{ gridColumn: 1, gridRow: 1 }} />
        {days.map((d, dayColIdx) => {
          const isToday = sameLocalDay(d, now);
          return (
            <div
              key={d.toISOString()}
              style={{
                gridColumn: dayColIdx + 2,
                gridRow: 1,
                textAlign: "center",
                fontWeight: 600,
                color: isToday ? "#1d4ed8" : "#334155",
                paddingBottom: 4,
                background: isToday ? "rgba(59, 130, 246, 0.12)" : undefined,
                borderRadius: 6,
                borderBottom: isToday ? "2px solid #3b82f6" : undefined
              }}
            >
              {d.toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" })}
            </div>
          );
        })}
        {TIME_SLOTS.flatMap((slot, slotRowIdx) => {
          const gridRow = 2 + slotRowIdx;
          const rowKey = `${slot.hour}-${slot.minute}`;
          const label = (
            <div
              key={`t-${rowKey}`}
              style={{
                gridColumn: 1,
                gridRow,
                color: "#64748b",
                textAlign: "right",
                paddingRight: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                fontSize: 10
              }}
            >
              {slotLabel(slot)}
            </div>
          );
          const cells = days.map((day, dayColIdx) => {
            const gridColumn = dayColIdx + 2;
            const kind = cellKind(day, slot, busy, proposedSlots);
            const proposedBlock = kind === "proposed" ? proposedSlotForCell(day, slot, proposedSlots) : null;
            const freeBlocked =
              kind === "free" && showDurationRules && isFreeStartInvalid(day, slot, durationMs, busy, rs, re);

            const selected = cellSelected(day, slot, selectedSlot);
            const isTodayCol = sameLocalDay(day, now);

            let title: string;
            if (kind === "proposed" && proposedBlock) {
              title = `Návrh agenta: ${formatSlotTooltip(proposedBlock.start, proposedBlock.end)}`;
              if (interactive) {
                title +=
                  " — klik: začátek v rámci zeleného návrhu a délka podle přepínače nad kalendářem (pokud nevyjde kolize s busy)";
              }
            } else if (kind === "busy") {
              title = "Obsazeno (kalendář)";
            } else if (freeBlocked) {
              title =
                "Nelze začít zde — prohlídka by zasáhla do obsazeného času nebo přesáhla zobrazené rozmezí.";
            } else if (interactive) {
              title = `Volný začátek ${slotLabel(slot)} — klik vybere termín zvolené délky`;
            } else if (previewDurationCollisions) {
              title = `Volný začátek ${slotLabel(slot)} — při zvolené délce lze zde začít (náhled, bez výběru)`;
            } else {
              title = "Volno";
            }

            const style = cellBase(kind, Boolean(freeBlocked));
            if (isTodayCol && kind !== "busy") {
              (style as CSSProperties).boxShadow = "inset 0 0 0 1px rgba(59, 130, 246, 0.25)";
            }
            if (selected) {
              style.boxShadow = `0 0 0 2px ${selectedAccent}`;
              style.zIndex = 2;
            }

            const cellPlacement = { gridColumn, gridRow, minWidth: 0 } as const;

            const agentMarker =
              kind === "proposed" ? (
                <span
                  style={{
                    position: "absolute",
                    right: 1,
                    top: 0,
                    fontSize: 8,
                    fontWeight: 800,
                    color: "rgba(255,255,255,0.95)",
                    lineHeight: 1,
                    textShadow: "0 0 2px #064e3c"
                  }}
                  aria-hidden
                >
                  A
                </span>
              ) : null;

            const inner = (
              <span style={{ position: "relative", display: "block", width: "100%", height: "100%" }}>
                {agentMarker}
              </span>
            );

            if (interactive && kind !== "busy" && !freeBlocked) {
              return (
                <button
                  key={`${day.toISOString()}-${rowKey}`}
                  type="button"
                  title={title}
                  aria-label={title}
                  onClick={() => handleCellActivate(day, slot, kind, Boolean(freeBlocked))}
                  style={{ ...style, ...cellPlacement, position: "relative" }}
                >
                  {inner}
                </button>
              );
            }

            return (
              <div
                key={`${day.toISOString()}-${rowKey}`}
                title={title}
                style={{ ...style, ...cellPlacement, position: "relative" }}
              >
                {kind === "proposed" ? inner : null}
              </div>
            );
          });
          return [label, ...cells];
        })}
        {nowOverlay}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          marginTop: 10,
          fontSize: 12,
          color: "#475569"
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: "linear-gradient(180deg,#34d399,#10b981)",
              border: "1px solid #047857",
              position: "relative",
              fontSize: 8,
              fontWeight: 800,
              color: "white",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            A
          </span>
          Návrh agenta
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: "#94a3b8", border: "1px solid #64748b" }} />
          Obsazeno
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: "#f1f5f9", border: "1px solid #e2e8f0" }} />
          Volno (klik = délka schůzky nastavená nad kalendářem)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: "repeating-linear-gradient(-45deg, #e2e8f0, #e2e8f0 2px, #f1f5f9 2px, #f1f5f9 4px)",
              border: "1px solid #cbd5e1"
            }}
          />
          Nelze začít (kolize s obsazením)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: "2px solid #7c3aed", background: "#f5f3ff" }} />
          Váš výběr z volna
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: "2px solid #047857", background: "#ecfdf5" }} />
          Výběr návrhu agenta
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 2, height: 14, background: "rgba(239, 68, 68, 0.92)", borderRadius: 1 }} />
          Aktuální čas (dnes)
        </span>
      </div>
    </div>
  );
}
