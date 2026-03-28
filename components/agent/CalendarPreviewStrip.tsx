"use client";

import { Fragment } from "react";

type Block = { start: string; end: string };

type Props = {
  busy: Block[];
  proposedSlots: Block[];
  rangeStart: string;
  rangeEnd: string;
};

function overlap(a0: Date, a1: Date, b0: Date, b1: Date): boolean {
  return a0 < b1 && a1 > b0;
}

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Stav buňky: navrhovaná prohlídka má přednost před busy. */
function cellKind(day: Date, hour: number, busy: Block[], proposed: Block[]): "proposed" | "busy" | "free" {
  const a0 = new Date(day);
  a0.setHours(hour, 0, 0, 0);
  const a1 = new Date(day);
  a1.setHours(hour + 1, 0, 0, 0);

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

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;

/**
 * Kompaktní náhled: dny × hodiny, busy vs. navrhované sloty (odlišná barva).
 */
export function CalendarPreviewStrip({ busy, proposedSlots, rangeStart, rangeEnd }: Props) {
  const days: Date[] = [];
  const cur = dayStart(new Date(rangeStart));
  const endD = dayStart(new Date(rangeEnd));
  if (Number.isNaN(cur.getTime()) || Number.isNaN(endD.getTime())) {
    return <p style={{ fontSize: 13, color: "#64748b" }}>Nelze vykreslit náhled kalendáře (neplatné rozmezí).</p>;
  }
  while (cur <= endD && days.length < 14) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const colTemplate = `52px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: colTemplate,
          gridTemplateRows: `auto repeat(${HOURS.length}, 16px)`,
          gap: 2,
          fontSize: 11,
          minWidth: Math.max(280, 52 + days.length * 36)
        }}
      >
        <div />
        {days.map((d) => (
          <div
            key={d.toISOString()}
            style={{
              textAlign: "center",
              fontWeight: 600,
              color: "#334155",
              paddingBottom: 4
            }}
          >
            {d.toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" })}
          </div>
        ))}
        {HOURS.map((hour) => (
          <Fragment key={hour}>
            <div
              style={{
                color: "#64748b",
                textAlign: "right",
                paddingRight: 6,
                alignSelf: "center"
              }}
            >
              {hour}:00
            </div>
            {days.map((day) => {
              const kind = cellKind(day, hour, busy, proposedSlots);
              const bg =
                kind === "proposed"
                  ? "linear-gradient(180deg,#34d399,#10b981)"
                  : kind === "busy"
                    ? "#94a3b8"
                    : "#f1f5f9";
              const border =
                kind === "proposed" ? "1px solid #047857" : kind === "busy" ? "1px solid #64748b" : "1px solid #e2e8f0";
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  title={
                    kind === "proposed"
                      ? "Navržená prohlídka"
                      : kind === "busy"
                        ? "Obsazeno (kalendář)"
                        : "Volný čas"
                  }
                  style={{
                    borderRadius: 3,
                    background: bg,
                    border,
                    minHeight: 14
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          marginTop: 10,
          fontSize: 12,
          color: "#475569"
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: "#10b981", border: "1px solid #047857" }} />
          Navržená prohlídka
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: "#94a3b8", border: "1px solid #64748b" }} />
          Obsazeno
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: "#f1f5f9", border: "1px solid #e2e8f0" }} />
          Volno
        </span>
      </div>
    </div>
  );
}
