"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { Button, Group, SegmentedControl, Stack, Tabs, Text } from "@mantine/core";
import { COLUMN_LABEL_CS, columnLabelCs } from "@/lib/agent/analytics/chart-labels-cs";
import {
  getAnalyticsTableDisplayKeys,
  type AnalyticsTablePanelKind
} from "@/lib/agent/analytics/table-display-columns";
import type {
  AgentDataPanel as AgentDataPanelModel,
  AgentDataPanelDownloads,
  ChartKind,
  DerivedChartModel
} from "@/lib/agent/types";
import { MarketListingsDataPanelSection } from "@/components/agent/MarketListingsDataPanelSection";
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

function headerLabel(key: string): string {
  return COLUMN_LABEL_CS[key] ?? columnLabelCs(key);
}

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
                {headerLabel(key)}
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

function CompactTableDownloads({ downloads }: { downloads?: AgentDataPanelDownloads }) {
  const excel = downloads?.excel;
  const csv = downloads?.csv;
  if (!excel && !csv) return null;
  return (
    <Group gap={6} mt="sm" wrap="wrap">
      <Text size="xs" c="dimmed" mr={4}>
        Tabulka:
      </Text>
      {excel ? (
        <Button
          component="a"
          href={excel}
          target="_blank"
          rel="noreferrer"
          download
          size="compact-xs"
          variant="light"
          color="teal"
        >
          Excel
        </Button>
      ) : null}
      {csv ? (
        <Button component="a" href={csv} target="_blank" rel="noreferrer" download size="compact-xs" variant="light" color="gray">
          CSV
        </Button>
      ) : null}
    </Group>
  );
}

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316"];

function ChartBarsSingle({
  labels,
  values,
  maxVal,
  color = "#3b82f6"
}: {
  labels: string[];
  values: number[];
  maxVal: number;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, minHeight: 140, paddingTop: 8, flexWrap: "wrap" }}>
      {labels.map((label, i) => {
        const v = values[i] ?? 0;
        const h = Math.round((v / maxVal) * 100);
        return (
          <div key={`${label}-${i}`} style={{ flex: "1 1 48px", display: "grid", gap: 6, justifyItems: "center", minWidth: 44 }}>
            <div
              title={`${label}: ${v}`}
              style={{
                width: "100%",
                maxWidth: 48,
                height: `${Math.max(h, 8)}px`,
                background: `linear-gradient(180deg, ${color}, ${color})`,
                borderRadius: 4,
                minHeight: 4
              }}
            />
            <span style={{ fontSize: 11, color: "#475569", textAlign: "center", lineHeight: 1.2 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChartBarsDual({
  labels,
  a,
  b,
  maxVal,
  labelA,
  labelB
}: {
  labels: string[];
  a: number[];
  b: number[];
  maxVal: number;
  labelA: string;
  labelB: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, minHeight: 148, paddingTop: 8, flexWrap: "wrap" }}>
      {labels.map((label, i) => {
        const av = a[i] ?? 0;
        const bv = b[i] ?? 0;
        const hA = Math.round((av / maxVal) * 100);
        const hB = Math.round((bv / maxVal) * 100);
        return (
          <div
            key={`${label}-${i}`}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 56 }}
          >
            <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 118 }}>
              <div
                title={`${labelA}: ${av}`}
                style={{
                  width: 22,
                  height: `${Math.max(hA, av > 0 ? 8 : 4)}px`,
                  background: "linear-gradient(180deg, #3b82f6, #1d4ed8)",
                  borderRadius: 4,
                  minHeight: 4
                }}
              />
              <div
                title={`${labelB}: ${bv}`}
                style={{
                  width: 22,
                  height: `${Math.max(hB, bv > 0 ? 8 : 4)}px`,
                  background: "linear-gradient(180deg, #10b981, #047857)",
                  borderRadius: 4,
                  minHeight: 4
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: "#475569", textAlign: "center", lineHeight: 1.2, maxWidth: 80 }}>
              {label}
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              {av} / {bv}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ChartLineSvg({
  labels,
  values,
  values2,
  color1 = "#2563eb",
  color2 = "#059669"
}: {
  labels: string[];
  values: number[];
  values2?: number[];
  color1?: string;
  color2?: string;
}) {
  const W = 520;
  const H = 220;
  const pad = 36;
  const n = labels.length;
  const maxV = Math.max(1, ...values, ...(values2 ?? []));
  const plotW = W - pad * 2;
  const plotH = H - pad * 2;
  const xAt = (i: number) => pad + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => pad + plotH - (v / maxV) * plotH;

  let d1 = "";
  let d2 = "";
  for (let i = 0; i < n; i++) {
    const x = xAt(i);
    const y = yAt(values[i] ?? 0);
    d1 += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  if (values2 && values2.length === n) {
    for (let i = 0; i < n; i++) {
      const x = xAt(i);
      const y = yAt(values2[i] ?? 0);
      d2 += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "100%" }}>
      <rect width="100%" height="100%" fill="#fff" rx={6} />
      <line x1={pad} y1={pad + plotH} x2={pad + plotW} y2={pad + plotH} stroke="#cbd5e1" />
      <line x1={pad} y1={pad} x2={pad} y2={pad + plotH} stroke="#cbd5e1" />
      {d1 ? <path d={d1} fill="none" stroke={color1} strokeWidth={2.5} /> : null}
      {d2 ? <path d={d2} fill="none" stroke={color2} strokeWidth={2.5} /> : null}
      {labels.map((lab, i) => (
        <text
          key={i}
          x={xAt(i)}
          y={H - 10}
          textAnchor="middle"
          fontSize={9}
          fill="#64748b"
        >
          {lab.length > 10 ? `${lab.slice(0, 9)}…` : lab}
        </text>
      ))}
    </svg>
  );
}

function ChartPieCss({ labels, values }: { labels: string[]; values: number[] }) {
  const total = values.reduce((s, v) => s + v, 0) || 1;
  let acc = 0;
  const stops: string[] = [];
  values.forEach((v, i) => {
    const start = (acc / total) * 360;
    acc += v;
    const end = (acc / total) * 360;
    stops.push(`${PIE_COLORS[i % PIE_COLORS.length]} ${start}deg ${end}deg`);
  });
  return (
    <Stack gap="xs" align="flex-start">
      <div
        style={{
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: `conic-gradient(${stops.join(", ")})`,
          border: "2px solid #e2e8f0"
        }}
      />
      <Stack gap={4}>
        {labels.map((lab, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: PIE_COLORS[i % PIE_COLORS.length]
              }}
            />
            <span>
              {lab}: {values[i] ?? 0}
            </span>
          </div>
        ))}
      </Stack>
    </Stack>
  );
}

function DerivedChartView({
  chart,
  hideChart,
  pngDownload
}: {
  chart: DerivedChartModel;
  hideChart?: boolean;
  /** Odpovídající položce z `chartPngs` (stejné pořadí jako grafy). */
  pngDownload?: { url: string; label?: string };
}) {
  const [displayKind, setDisplayKind] = useState<ChartKind>(chart.kind);
  const dual =
    chart.kind === "line" &&
    chart.series2Values &&
    chart.series2Values.length === chart.labels.length;
  const s2 = dual ? chart.series2Values! : undefined;
  const canPie = !dual;

  const maxSingle = useMemo(() => Math.max(1, ...chart.values), [chart.values]);
  const maxDual = useMemo(
    () => Math.max(1, ...chart.values, ...(s2 ?? [])),
    [chart.values, s2]
  );

  const segData = canPie
    ? [
        { value: "bar", label: "Sloupce" },
        { value: "line", label: "Čára" },
        { value: "pie", label: "Koláč" }
      ]
    : [
        { value: "bar", label: "Sloupce" },
        { value: "line", label: "Čára" }
      ];

  if (hideChart) {
    return (
      <Stack gap="xs">
        <Text fw={600}>{chart.title}</Text>
        <Text size="sm" c="dimmed">
          Graf je podle zadání skrytý (zobrazena tabulka na záložce Tabulka).
        </Text>
      </Stack>
    );
  }

  if (chart.labels.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nedostatek dat pro graf.
      </Text>
    );
  }

  const legend = chart.legend?.length ? (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
      {chart.legend.map((item, i) => (
        <span key={i}>
          <span
            style={{
              color: i === 0 ? "#1d4ed8" : "#047857",
              marginRight: 6
            }}
            aria-hidden
          >
            ■
          </span>
          {item.label}
        </span>
      ))}
    </div>
  ) : null;

  const unitNote = chart.valueUnit ? (
    <Text size="xs" c="dimmed">
      Jednotka: {chart.valueUnit} · {chart.axisLabelY}
    </Text>
  ) : (
    <Text size="xs" c="dimmed">
      {chart.axisLabelY}
    </Text>
  );

  return (
    <Stack gap="sm" pb="md" style={{ borderBottom: "1px solid #e2e8f0" }}>
      <Text fw={600}>{chart.title}</Text>
      {chart.subtitle ? (
        <Text size="xs" c="dimmed">
          {chart.subtitle}
        </Text>
      ) : null}
      {unitNote}
      <SegmentedControl size="xs" value={displayKind} onChange={(v) => setDisplayKind(v as ChartKind)} data={segData} />
      {displayKind === "bar" ? (
        dual && s2 ? (
          <ChartBarsDual
            labels={chart.labels}
            a={chart.values}
            b={s2}
            maxVal={maxDual}
            labelA={chart.legend?.[0]?.label ?? "Série 1"}
            labelB={chart.legend?.[1]?.label ?? chart.series2Label ?? "Série 2"}
          />
        ) : (
          <ChartBarsSingle labels={chart.labels} values={chart.values} maxVal={maxSingle} />
        )
      ) : null}
      {displayKind === "line" ? (
        <ChartLineSvg
          labels={chart.labels}
          values={chart.values}
          values2={s2}
        />
      ) : null}
      {displayKind === "pie" && canPie ? <ChartPieCss labels={chart.labels} values={chart.values} /> : null}
      {chart.legend && chart.legend.length > 0 && !(dual && displayKind === "bar") ? legend : null}
      {pngDownload?.url ? (
        <Group gap={6} mt="xs">
          <Button
            component="a"
            href={pngDownload.url}
            target="_blank"
            rel="noreferrer"
            download
            size="compact-xs"
            variant="light"
            color="gray"
            title={pngDownload.label}
          >
            PNG
          </Button>
        </Group>
      ) : null}
    </Stack>
  );
}

type AnalyticsPanelCommon = {
  source: string;
  rows: Record<string, unknown>[];
  charts: DerivedChartModel[];
  hideChart?: boolean;
  rowsTruncationNote?: string;
  dataPanelDownloads?: AgentDataPanelDownloads;
  title?: string;
  /** Sloupce tabulky v UI — exporty dál berou všechny sloupce z dat. */
  analyticsTableKind: AnalyticsTablePanelKind;
};

function AnalyticsDataPanelTabs(props: AnalyticsPanelCommon) {
  const { source, rows, charts, hideChart, rowsTruncationNote, dataPanelDownloads, title, analyticsTableKind } = props;
  const fullKeys = useMemo(() => orderedKeysForRows(rows), [rows]);
  const displayKeys = useMemo(
    () => getAnalyticsTableDisplayKeys(analyticsTableKind, rows),
    [analyticsTableKind, rows]
  );
  const orderedKeys = displayKeys.length > 0 ? displayKeys : fullKeys;
  const headerTitle = title ?? "Data z dotazu";

  return (
    <div style={panelChrome}>
      <div>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{headerTitle}</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Zdroj: <code>{source}</code> · {rows.length} řádků v tabulce
        </p>
        {rowsTruncationNote ? (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#b45309" }}>{rowsTruncationNote}</p>
        ) : null}
      </div>

      <Tabs defaultValue="table" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="table">Tabulka</Tabs.Tab>
          <Tabs.Tab value="charts">Grafy</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="table" pt="md">
          {charts.length > 0 ? (
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>
              Grafy vycházejí ze stejných {rows.length} řádků jako tato tabulka.
            </p>
          ) : null}
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>Tabulka</div>
          <ClientsTable rows={rows} orderedKeys={orderedKeys} />
          <CompactTableDownloads downloads={dataPanelDownloads} />
        </Tabs.Panel>
        <Tabs.Panel value="charts" pt="md">
          {charts.length === 0 ? (
            <Text size="sm" c="dimmed">
              {hideChart
                ? "Grafy jsou pro tento běh vypnuté podle zadání."
                : "Pro tato data není k dispozici odvozený graf. Zkuste upřesnit dotaz (např. rozklad podle kanálu nebo města)."}
            </Text>
          ) : (
            <Stack gap="lg">
              {charts.map((c, i) => (
                <DerivedChartView
                  key={i}
                  chart={c}
                  hideChart={hideChart}
                  pngDownload={
                    dataPanelDownloads?.chartPngs?.[i]
                      ? {
                          url: dataPanelDownloads.chartPngs[i]!.url,
                          label: dataPanelDownloads.chartPngs[i]!.label
                        }
                      : undefined
                  }
                />
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
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
      <Text size="sm" c="dimmed">
        Návrh e-mailu a příjemce jsou v postranním panelu v záložce <strong>Maily</strong>. Kalendář a výběr termínu
        najdete zde ve vláknu chatu pod touto odpovědí.
      </Text>
    );
  }

  if (panel.kind === "leads_sales_6m") {
    return (
      <AnalyticsDataPanelTabs
        source={panel.source}
        rows={panel.rows}
        charts={panel.charts}
        hideChart={panel.hideChart}
        rowsTruncationNote={panel.rowsTruncationNote}
        dataPanelDownloads={dataPanelDownloads}
        title="Leady vs prodané byty"
        analyticsTableKind="leads_sales_6m"
      />
    );
  }

  if (panel.kind === "clients_filtered") {
    return (
      <AnalyticsDataPanelTabs
        source={panel.source}
        rows={panel.rows}
        charts={panel.charts ?? []}
        hideChart={panel.hideChart}
        rowsTruncationNote={panel.rowsTruncationNote}
        dataPanelDownloads={dataPanelDownloads}
        title={panel.title}
        analyticsTableKind="clients_filtered"
      />
    );
  }

  if (panel.kind === "deal_sales_detail") {
    return (
      <AnalyticsDataPanelTabs
        source={panel.source}
        rows={panel.rows}
        charts={panel.charts ?? []}
        hideChart={panel.hideChart}
        rowsTruncationNote={panel.rowsTruncationNote}
        dataPanelDownloads={dataPanelDownloads}
        title={panel.title}
        analyticsTableKind="deal_sales_detail"
      />
    );
  }

  if (panel.kind === "clients_q1") {
    return (
      <AnalyticsDataPanelTabs
        source={panel.source}
        rows={panel.rows}
        charts={panel.charts}
        hideChart={panel.hideChart}
        rowsTruncationNote={panel.rowsTruncationNote}
        dataPanelDownloads={dataPanelDownloads}
        title="Data z dotazu"
        analyticsTableKind="clients_q1"
      />
    );
  }

  return null;
}
