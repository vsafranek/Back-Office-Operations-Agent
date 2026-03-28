"use client";

import type { CSSProperties } from "react";
import type {
  AgentDataPanel as AgentDataPanelModel,
  AgentDataPanelDownloads
} from "@/lib/agent/types";
import { MarketListingsDataPanelSection } from "@/components/agent/MarketListingsDataPanelSection";
import { ViewingEmailDraftPanel } from "@/components/agent/ViewingEmailDraftPanel";
import { ScheduledTaskConfirmationPanel } from "@/components/agent/ScheduledTaskConfirmationPanel";

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

const CLIENT_TABLE_COLUMN_ORDER = [
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

function orderedKeysForRows(rows: Record<string, unknown>[]): string[] {
  const keysFromRow =
    rows.length > 0 ? Object.keys(rows[0]!).filter((k) => k !== "id") : [...CLIENT_TABLE_COLUMN_ORDER];
  return [
    ...CLIENT_TABLE_COLUMN_ORDER.filter((k) => keysFromRow.includes(k)),
    ...keysFromRow.filter((k) => !CLIENT_TABLE_COLUMN_ORDER.includes(k as (typeof CLIENT_TABLE_COLUMN_ORDER)[number]))
  ];
}

function ClientsTable({
  rows,
  orderedKeys
}: {
  rows: Record<string, unknown>[];
  orderedKeys: string[];
}) {
  return (
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
  );
}

const panelChrome: CSSProperties = {
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
};

function downloadLinkStyle(primary: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    textDecoration: "none",
    cursor: "pointer",
    border: primary ? "1px solid #059669" : "1px solid #cbd5e1",
    background: primary ? "linear-gradient(180deg,#ecfdf5,#d1fae5)" : "#fff",
    color: primary ? "#065f46" : "#334155"
  };
}

/** Tlačítka stažení vedle tabulky a grafu (stejné soubory jako v artefaktech). */
function DataPanelDownloads({ downloads }: { downloads?: AgentDataPanelDownloads }) {
  if (!downloads?.excel && !downloads?.csv) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        paddingBottom: 12,
        marginBottom: 4,
        borderBottom: "1px solid #e2e8f0"
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Stažení dat</span>
      {downloads.excel ? (
        <a
          href={downloads.excel}
          target="_blank"
          rel="noreferrer"
          download
          style={downloadLinkStyle(true)}
        >
          Excel (.xlsx)
        </a>
      ) : null}
      {downloads.csv ? (
        <a href={downloads.csv} target="_blank" rel="noreferrer" download style={downloadLinkStyle(false)}>
          CSV
        </a>
      ) : null}
    </div>
  );
}

export function AgentDataPanel({
  panel,
  getAccessToken,
  dataPanelDownloads
}: {
  panel: AgentDataPanelModel;
  getAccessToken?: () => Promise<string | null>;
  dataPanelDownloads?: AgentDataPanelDownloads;
}) {
  if (panel.kind === "market_listings") {
    return (
      <MarketListingsDataPanelSection
        title={panel.title}
        fetchParams={panel.fetchParams}
        initialListings={panel.listings}
        getAccessToken={getAccessToken}
      />
    );
  }

  if (panel.kind === "scheduled_task_confirmation") {
    return <ScheduledTaskConfirmationPanel draft={panel.draft} getAccessToken={getAccessToken} />;
  }

  if (panel.kind === "viewing_email_draft") {
    return (
      <ViewingEmailDraftPanel
        slots={panel.slots}
        calendarPreview={panel.calendarPreview}
        senderDisplayName={panel.senderDisplayName}
        draft={panel.draft}
        relatedLeadIds={panel.relatedLeadIds}
        getAccessToken={getAccessToken}
        conversationId={panel.conversationId}
        agentRunId={panel.agentRunId}
      />
    );
  }

  if (panel.kind === "leads_sales_6m") {
    const { chart } = panel;
    const maxVal = Math.max(
      1,
      ...chart.labels.map((_, i) => Math.max(chart.leads[i] ?? 0, chart.sold[i] ?? 0))
    );
    const orderedKeys = orderedKeysForRows(panel.rows);
    return (
      <div style={panelChrome}>
        <DataPanelDownloads downloads={dataPanelDownloads} />
        <div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Leady vs prodeje</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Zdroj: <code>{panel.source}</code> · {panel.rows.length} měsíců v datech
          </p>
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>{chart.title}</div>
          {panel.hideChart ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
              Graf je podle zadání skrytý (zobrazena tabulka níže). Znovu se zeptejte včetně požadavku na graf.
            </p>
          ) : chart.labels.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Žádná data pro graf.</p>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 14,
                  minHeight: 148,
                  paddingTop: 8,
                  flexWrap: "wrap"
                }}
              >
                {chart.labels.map((label, i) => {
                  const lv = chart.leads[i] ?? 0;
                  const sv = chart.sold[i] ?? 0;
                  const hL = Math.round((lv / maxVal) * 100);
                  const hS = Math.round((sv / maxVal) * 100);
                  return (
                    <div
                      key={`${label}-${i}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        minWidth: 56
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 5,
                          alignItems: "flex-end",
                          height: 118
                        }}
                      >
                        <div
                          title={`Leady: ${lv}`}
                          style={{
                            width: 22,
                            height: `${Math.max(hL, lv > 0 ? 8 : 4)}px`,
                            background: "linear-gradient(180deg, #3b82f6, #1d4ed8)",
                            borderRadius: 4,
                            minHeight: 4
                          }}
                        />
                        <div
                          title={`Prodané: ${sv}`}
                          style={{
                            width: 22,
                            height: `${Math.max(hS, sv > 0 ? 8 : 4)}px`,
                            background: "linear-gradient(180deg, #10b981, #047857)",
                            borderRadius: 4,
                            minHeight: 4
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#475569",
                          textAlign: "center",
                          lineHeight: 1.2,
                          maxWidth: 80
                        }}
                      >
                        {label}
                      </span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        {lv} / {sv}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  fontSize: 12,
                  marginTop: 10,
                  color: "#475569"
                }}
              >
                <span>
                  <span style={{ color: "#1d4ed8", marginRight: 6 }} aria-hidden>
                    ■
                  </span>
                  Leady
                </span>
                <span>
                  <span style={{ color: "#047857", marginRight: 6 }} aria-hidden>
                    ■
                  </span>
                  Prodané
                </span>
              </div>
            </>
          )}
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>Tabulka</div>
          <ClientsTable rows={panel.rows} orderedKeys={orderedKeys} />
        </div>
      </div>
    );
  }

  if (panel.kind === "clients_filtered") {
    const orderedKeys = orderedKeysForRows(panel.rows);
    return (
      <div style={panelChrome}>
        <DataPanelDownloads downloads={dataPanelDownloads} />
        <div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{panel.title}</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Zdroj: <code>{panel.source}</code> · {panel.rows.length} řádků
          </p>
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>Tabulka</div>
          <ClientsTable rows={panel.rows} orderedKeys={orderedKeys} />
        </div>
      </div>
    );
  }

  if (panel.kind !== "clients_q1") {
    return null;
  }

  const rows = panel.rows;
  const orderedKeys = orderedKeysForRows(rows);
  const maxVal = panel.chart.values.length ? Math.max(...panel.chart.values, 1) : 1;

  return (
    <div style={panelChrome}>
      <DataPanelDownloads downloads={dataPanelDownloads} />
      <div>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Data z dotazu</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Zdroj: <code>{panel.source}</code> · {rows.length} řádků
        </p>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>{panel.chart.title}</div>
        {panel.hideChart ? (
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            Graf je podle zadání skrytý (zobrazena tabulka níže).
          </p>
        ) : panel.chart.labels.length === 0 ? (
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
        <ClientsTable rows={rows} orderedKeys={orderedKeys} />
      </div>
    </div>
  );
}
