import type {
  AgentAnswer,
  AgentArtifact,
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

const ARTIFACT_TYPES = new Set<AgentArtifact["type"]>(["chart", "table", "report", "presentation", "email"]);

/** Artefakty z uložené metadata zprávy (bez panelu) — např. PPTX/PDF po F5. */
export function generatedArtifactsFromAssistantMetadata(metadata: Record<string, unknown>): AgentArtifact[] {
  const arts = metadata.generated_artifacts;
  if (!Array.isArray(arts)) return [];
  const out: AgentArtifact[] = [];
  for (const a of arts) {
    if (!isRecord(a)) continue;
    const type = a.type;
    if (typeof type !== "string" || !ARTIFACT_TYPES.has(type as AgentArtifact["type"])) continue;
    const label = typeof a.label === "string" && a.label.trim() ? a.label : "Soubor";
    out.push({
      type: type as AgentArtifact["type"],
      label,
      ...(typeof a.url === "string" && a.url.trim() ? { url: a.url.trim() } : {}),
      ...(typeof a.content === "string" ? { content: a.content } : {})
    });
  }
  return out;
}

/** Zda zpráva má v metadatech aspoň jeden artefakt s URL (soubor v úložišti / veřejný odkaz). */
export function assistantMetadataHasArtifactUrls(metadata: Record<string, unknown>): boolean {
  return generatedArtifactsFromAssistantMetadata(metadata).some(
    (a) => typeof a.url === "string" && a.url.trim().length > 0
  );
}

/** Odpovědi vhodné pro navigaci ve Storage (ne e-mailové návrhy). */
export function assistantMetadataHasStorageLinkedArtifacts(metadata: Record<string, unknown>): boolean {
  return generatedArtifactsFromAssistantMetadata(metadata).some(
    (a) => a.type !== "email" && typeof a.url === "string" && a.url.trim().length > 0
  );
}

/** Panely, které patří do navigace „Tabulka / graf“ (ne nabídky, e-mail ani potvrzení cron úlohy). */
const TABLE_OR_CHART_PANEL_KINDS = new Set<AgentDataPanel["kind"]>([
  "clients_q1",
  "leads_sales_6m",
  "clients_filtered",
  "deal_sales_detail",
  "missing_reconstruction"
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

/** True, pokud odpověď obsahuje panel s kartami nabídek (postranní panel Nabídky). */
export function agentPayloadHasMarketListingsPanel(raw: unknown): boolean {
  const slice = agentAnswerSliceFromPersistPayload(raw);
  if (!slice) return false;
  return bundlesFromSlice(slice).some((b) => b.dataPanel.kind === "market_listings");
}

/** Krátký popisek pro přepínač běhů s nabídkami. */
export function marketListingsPreviewFromPayload(raw: unknown): string | null {
  const slice = agentAnswerSliceFromPersistPayload(raw);
  if (!slice) return null;
  for (const b of bundlesFromSlice(slice)) {
    if (b.dataPanel.kind === "market_listings") {
      const t = b.dataPanel.title?.trim();
      if (t && t.length > 0) return t.length > 64 ? `${t.slice(0, 61)}…` : t;
      return "Nabídky z běhu agenta";
    }
  }
  return null;
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
