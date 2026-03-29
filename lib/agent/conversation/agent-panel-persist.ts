import type {
  AgentAnswer,
  AgentDataPanel,
  AgentDataPanelBundle,
  AgentDataPanelDownloads
} from "@/lib/agent/types";

export const AGENT_PANEL_PAYLOAD_KEY = "agentPanelPayload";
export const AGENT_PANEL_MAX_ROWS = 500;

export type AgentPanelPersistBundle = {
  dataPanel: AgentDataPanel;
  dataPanelDownloads?: AgentDataPanelDownloads;
  /** Celkový počet řádků před ořezem (jen analytické panely s rows). */
  rowCountFull?: number;
};

export type AgentPanelPersistPayloadV1 = {
  v: 1;
  bundles: AgentPanelPersistBundle[];
};

function rowCountForPanel(panel: AgentDataPanel): number {
  if (
    panel.kind === "clients_q1" ||
    panel.kind === "leads_sales_6m" ||
    panel.kind === "clients_filtered" ||
    panel.kind === "deal_sales_detail" ||
    panel.kind === "missing_reconstruction"
  ) {
    return panel.rows.length;
  }
  if (panel.kind === "market_listings") return panel.listings.length;
  return 0;
}

function truncateRowsInPanel(panel: AgentDataPanel, maxRows: number, fullRowCount: number): AgentDataPanel {
  if (
    panel.kind === "clients_q1" ||
    panel.kind === "leads_sales_6m" ||
    panel.kind === "clients_filtered" ||
    panel.kind === "deal_sales_detail" ||
    panel.kind === "missing_reconstruction"
  ) {
    if (panel.rows.length <= maxRows) return panel;
    const note = `Zobrazeno prvních ${maxRows} z ${fullRowCount} řádků; úplná data jsou v Excel / CSV.`;
    return { ...panel, rows: panel.rows.slice(0, maxRows), rowsTruncationNote: note };
  }
  return panel;
}

function bundleFromAnswerPart(panel: AgentDataPanel, downloads?: AgentDataPanelDownloads): AgentPanelPersistBundle {
  const full = rowCountForPanel(panel);
  const truncated = truncateRowsInPanel(panel, AGENT_PANEL_MAX_ROWS, full);
  return {
    dataPanel: truncated,
    dataPanelDownloads: downloads,
    ...(full > AGENT_PANEL_MAX_ROWS ? { rowCountFull: full } : {})
  };
}

/** Serializovatelný obsah panelu pro metadata assistant zprávy (ořez řádků). */
export function buildAgentPanelPersistPayload(answer: AgentAnswer): AgentPanelPersistPayloadV1 | null {
  const bundles: AgentDataPanelBundle[] =
    answer.dataPanelBundles && answer.dataPanelBundles.length > 0
      ? answer.dataPanelBundles
      : answer.dataPanel
        ? [{ dataPanel: answer.dataPanel, dataPanelDownloads: answer.dataPanelDownloads }]
        : [];

  if (bundles.length === 0) return null;

  return {
    v: 1,
    bundles: bundles.map((b) => bundleFromAnswerPart(b.dataPanel, b.dataPanelDownloads))
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Obnoví část AgentAnswer z uložené metadata (po F5). */
export function agentAnswerSliceFromPersistPayload(raw: unknown): Pick<
  AgentAnswer,
  "dataPanel" | "dataPanelDownloads" | "dataPanelBundles"
> | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  const bundlesRaw = raw.bundles;
  if (!Array.isArray(bundlesRaw) || bundlesRaw.length === 0) return null;

  const out: AgentDataPanelBundle[] = [];
  for (const b of bundlesRaw) {
    if (!isRecord(b) || !b.dataPanel) continue;
    out.push({
      dataPanel: b.dataPanel as AgentDataPanel,
      dataPanelDownloads: b.dataPanelDownloads as AgentDataPanelDownloads | undefined
    });
  }
  if (out.length === 0) return null;

  if (out.length === 1) {
    const only = out[0]!;
    return {
      dataPanel: only.dataPanel,
      dataPanelDownloads: only.dataPanelDownloads
    };
  }
  return {
    dataPanel: out[0]!.dataPanel,
    dataPanelDownloads: out[0]!.dataPanelDownloads,
    dataPanelBundles: out
  };
}

/** Panely, které patří do navigace „Tabulka / graf“ (ne e-mail ani potvrzení cron úlohy). */
const TABLE_OR_CHART_PANEL_KINDS = new Set<AgentDataPanel["kind"]>([
  "clients_q1",
  "leads_sales_6m",
  "clients_filtered",
  "deal_sales_detail",
  "missing_reconstruction",
  "market_listings"
]);

function bundlesFromSlice(slice: NonNullable<ReturnType<typeof agentAnswerSliceFromPersistPayload>>) {
  return slice.dataPanelBundles && slice.dataPanelBundles.length > 0
    ? slice.dataPanelBundles
    : slice.dataPanel
      ? [{ dataPanel: slice.dataPanel }]
      : [];
}

/** True, pokud v uloženém payloadu je aspoň jeden tabulkový / grafický panel. */
export function agentPayloadHasTableOrChartPanel(raw: unknown): boolean {
  const slice = agentAnswerSliceFromPersistPayload(raw);
  if (!slice) return false;
  return bundlesFromSlice(slice).some((b) => TABLE_OR_CHART_PANEL_KINDS.has(b.dataPanel.kind));
}

/** Návrh e-mailu (prohlídka) v persistovaném payloadu zprávy. */
export function agentPayloadHasViewingEmailDraft(raw: unknown): boolean {
  const slice = agentAnswerSliceFromPersistPayload(raw);
  if (!slice) return false;
  return bundlesFromSlice(slice).some((b) => b.dataPanel.kind === "viewing_email_draft");
}

/** Krátký popis pro přepínač běhů (předmět návrhu). */
export function viewingEmailDraftPreviewFromPayload(raw: unknown): string | null {
  const slice = agentAnswerSliceFromPersistPayload(raw);
  if (!slice) return null;
  for (const b of bundlesFromSlice(slice)) {
    if (b.dataPanel.kind === "viewing_email_draft") {
      const s = b.dataPanel.draft.subject?.trim();
      if (s && s.length > 0) return s.length > 64 ? `${s.slice(0, 61)}…` : s;
      return "Návrh e-mailu (prohlídka)";
    }
  }
  return null;
}
