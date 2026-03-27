"use client";

import type { AgentDataPanel as AgentDataPanelModel } from "@/lib/agent/types";

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const CLIENT_Q1_COLUMNS = [
  "full_name",
  "email",
  "phone",
  "source_channel",
  "preferred_city",
  "preferred_district",
  "property_type_interest",
  "budget_min_czk",
  "budget_max_czk",
  "property_notes",
  "created_at"
] as const;

export function AgentDataPanel({ panel }: { panel: AgentDataPanelModel }) {
  if (panel.kind !== "clients_q1") {
    return null;
  }

  const rows = panel.rows;
  const keysFromRow =
    rows.length > 0 ? Object.keys(rows[0]!).filter((k) => k !== "id") : [...CLIENT_Q1_COLUMNS];
  const orderedKeys = [
    ...CLIENT_Q1_COLUMNS.filter((k) => keysFromRow.includes(k)),
    ...keysFromRow.filter((k) => !CLIENT_Q1_COLUMNS.includes(k as (typeof CLIENT_Q1_COLUMNS)[number]))
  ];

  const maxVal = panel.chart.values.length ? Math.max(...panel.chart.values, 1) : 1;

  return (
    <div
      style={{
        position: "sticky",
        top: 12,
        display: "grid",
        gap: 20,
        alignContent: "start",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 14,
        background: "#fafafa",
        maxHeight: "calc(100vh - 48px)",
        overflow: "auto"
      }}
    >
      <div>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Data z dotazu</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Zdroj: <code>{panel.source}</code> · {rows.length} řádků
        </p>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>{panel.chart.title}</div>
        {panel.chart.labels.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Žádná data pro graf.</p>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, minHeight: 140, paddingTop: 8 }}>
            {panel.chart.labels.map((label, i) => {
              const v = panel.chart.values[i] ?? 0;
              const h = Math.round((v / maxVal) * 100);
              return (
                <div key={`${label}-${i}`} style={{ flex: 1, display: "grid", gap: 6, justifyItems: "center" }}>
                  <div
                    title={`${label}: ${v}`}
                    style={{
                      width: "100%",
                      maxWidth: 48,
                      height: `${Math.max(h, 8)}px`,
                      background: "linear-gradient(180deg, #3b82f6, #1d4ed8)",
                      borderRadius: 4,
                      minHeight: 4
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#475569", textAlign: "center", lineHeight: 1.2 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{v}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>Tabulka</div>
        <div style={{ overflow: "auto", maxHeight: 320, border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                {orderedKeys.map((key) => (
                  <th key={key} style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(orderedKeys.length, 1)} style={{ padding: 12, color: "#64748b" }}>
                    Žádné řádky.
                  </td>
                </tr>
              ) : (
                rows.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 ? "#fff" : "#f8fafc" }}>
                    {orderedKeys.map((key) => (
                      <td
                        key={key}
                        style={{
                          padding: "8px 10px",
                          borderBottom: "1px solid #f1f5f9",
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {formatCell(row[key])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
