import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";
import type { ClassifiedAgentIntent } from "@/lib/agent/llm/intent-classifier";

export type AgentArtifact = {
  type: "chart" | "table" | "report" | "presentation" | "email";
  label: string;
  url?: string;
  content?: string;
};

export type ChartKind = "bar" | "line" | "pie";

export type DerivedChartLegendItem = { label: string };

/** Graf odvozený jen z agregace řádků tabulky (server + UI + export PNG). */
export type DerivedChartModel =
  | {
      kind: "bar";
      title: string;
      subtitle?: string;
      axisLabelX: string;
      axisLabelY: string;
      valueUnit: string;
      labels: string[];
      values: number[];
      legend?: DerivedChartLegendItem[];
      rowCountInTable: number;
    }
  | {
      kind: "line";
      title: string;
      subtitle?: string;
      axisLabelX: string;
      axisLabelY: string;
      valueUnit: string;
      labels: string[];
      values: number[];
      series2Values?: number[];
      series2Label?: string;
      legend?: DerivedChartLegendItem[];
      rowCountInTable: number;
    }
  | {
      kind: "pie";
      title: string;
      subtitle?: string;
      axisLabelX: string;
      axisLabelY: string;
      valueUnit: string;
      labels: string[];
      values: number[];
      legend?: DerivedChartLegendItem[];
      rowCountInTable: number;
    };

export type AgentDataPanelChartPng = { label: string; url: string; kind?: ChartKind };

/** Odkazy k exportu dat zobrazených vedle tabulky/grafu v pravém panelu. */
export type AgentDataPanelDownloads = {
  excel?: string;
  csv?: string;
  /** PNG grafů (stejné soubory jako v artefaktech). */
  chartPngs?: AgentDataPanelChartPng[];
};

export type AgentOrchestrationMeta = {
  agentId: string;
  mode: "basic" | "thinking";
  /** K dispozici u režimu thinking – stručná úvaha před výběrem intentu. */
  reasoning?: string;
};

/** Strukturovaná data pro pravý panel dashboardu (tabulka + volitelný graf). */
/** Jedna kartička nabídky v pravém panelu (Sreality styl). */
export type AgentMarketListingCard = {
  external_id: string;
  title: string;
  location: string;
  source: string;
  url: string;
  image_url?: string;
};

/** Kandidát na příjemce e-mailu (CRM) — stejný tvar jako `EmailRecipientCandidate` na serveru, bez importu server modulu do klienta. */
export type ViewingEmailRecipientCandidate = {
  kind: "client" | "lead";
  id: string;
  fullName: string | null;
  email: string;
};

export type AgentDataPanel =
  | {
      kind: "clients_q1";
      source: string;
      rows: Record<string, unknown>[];
      charts: DerivedChartModel[];
      /** Skryje blok grafu v UI (např. „jen tabulka“). */
      hideChart?: boolean;
      /** Po obnovení z konverzace: tabulka může být ořezaná (viz Excel/CSV). */
      rowsTruncationNote?: string;
    }
  | {
      kind: "leads_sales_6m";
      source: string;
      rows: Record<string, unknown>[];
      charts: DerivedChartModel[];
      hideChart?: boolean;
      rowsTruncationNote?: string;
    }
  | {
      kind: "clients_filtered";
      source: string;
      /** Nadpis nad tabulkou (např. vyhledaná oblast). */
      title: string;
      rows: Record<string, unknown>[];
      /** Odvozené grafy z týchž řádků (volitelné). */
      charts?: DerivedChartModel[];
      hideChart?: boolean;
      rowsTruncationNote?: string;
    }
  | {
      kind: "deal_sales_detail";
      source: string;
      title: string;
      rows: Record<string, unknown>[];
      charts?: DerivedChartModel[];
      hideChart?: boolean;
      rowsTruncationNote?: string;
    }
  | {
      kind: "market_listings";
      title: string;
      /**
       * Parametry pro POST /api/market-listings (stejné jako nástroj fetchMarketListings).
       * UI si podle nich zavolá API a vyplní karty. (Volitelné u starších uložených odpovědí.)
       */
      fetchParams?: Record<string, unknown>;
      /**
       * Legacy / přednačtení; při `fetchParams` preferuje komponenta data z API.
       * Může zůstat prázdné v odpovědi agenta.
       */
      listings: AgentMarketListingCard[];
    }
  | {
      kind: "viewing_email_draft";
      /** Kandidáti z CRM (klienti / leady) k doplnění příjemce; UI + follow-up v chatu. */
      recipientCandidates?: ViewingEmailRecipientCandidate[];
      /** Shrnutí nemovitosti z CRM (lead → property), pro doplnění do těla zprávy. */
      propertySummary?: string;
      /**
       * Délka schůzky v minutách odvozená z dotazu (krok 15). Výchozí přepínač nad kalendářem v chatu.
       * Starší uložené odpovědi pole nemají — UI vezme délku z prvního slotu.
       */
      meetingDurationMinutes?: number;
      /** Volné sloty z Google Calendar (free/busy). */
      slots: { start: string; end: string }[];
      /** Obsazené úseky + okno pro náhled v UI (volitelné u starších uložených odpovědí). */
      calendarPreview?: {
        busy: { start: string; end: string }[];
        rangeStart: string;
        rangeEnd: string;
      };
      /** Jméno odesílatele (podpis v e-mailu). */
      senderDisplayName?: string;
      /** Předvyplněný draft; uživatel upraví a schválí v panelu → POST /api/google/email-draft. */
      draft: { to: string; subject: string; body: string };
      /** Volitelné UUID leadů k propojení s auditním záznamem odchozího e-mailu. */
      relatedLeadIds?: string[];
      /** Korelace pro audit (BOA-004 Volitelné u starších odpovědí bez těchto polí.) */
      conversationId?: string | null;
      agentRunId?: string | null;
    }
  | {
      kind: "scheduled_task_confirmation";
      /** Návrh úlohy k uložení po potvrzení v panelu (POST /api/settings/scheduled-tasks). */
      draft: {
        title: string;
        cron_expression: string;
        timezone: string;
        system_prompt: string;
        user_question: string;
        agent_id: string;
      };
    };

/** Jedna datová / UI sada pod odpovědí (např. po sloučení více podotázek). */
export type AgentDataPanelBundle = {
  dataPanel: AgentDataPanel;
  dataPanelDownloads?: AgentDataPanelDownloads;
};

export type AgentAnswer = {
  /** Korelace s řádky v agent_trace_events; doplní `runBackOfficeAgent`. */
  runId?: string;
  /** Záměr z klasifikátoru — pro UI (např. skrýt audit u čistě konverzační odpovědi). */
  intent?: ClassifiedAgentIntent["intent"];
  answer_text: string;
  confidence: number;
  sources: string[];
  generated_artifacts: AgentArtifact[];
  next_actions: string[];
  orchestration?: AgentOrchestrationMeta;
  /** Volitelné: vykreslení v UI (např. analytics Q1 klienti). */
  dataPanel?: AgentDataPanel;
  /** Volitelné: tlačítka stažení vedle panelu (např. Excel z report artefaktů). */
  dataPanelDownloads?: AgentDataPanelDownloads;
  /** Více panelů pod jednou odpovědí (sloučené podotázky); pokud je pole neprázdné, UI je vykreslí všechny. */
  dataPanelBundles?: AgentDataPanelBundle[];
};

export type AgentToolContext = {
  runId: string;
  userId: string;
  conversationId?: string | null;
  trace?: AgentTraceRecorder;
  traceParentId?: string | null;
  /**
   * Klíč pro cesty v Storage (`reports/{key}/…`). Odliší artefakty více podúloh v jednom běhu agenta.
   * Když chybí, použije se `runId`.
   */
  artifactStorageKey?: string | null;
};

/** Jednoznačný prefix souborů reportů / grafů v bucketu pro aktuální podúlohu. */
export function agentArtifactStoragePathKey(ctx: AgentToolContext): string {
  const k = ctx.artifactStorageKey?.trim();
  return k && k.length > 0 ? k : ctx.runId;
}

/** Řádek NDJSON z POST /api/agent/stream. */
export type AgentStreamLine =
  | { type: "phase"; label: string }
  | { type: "orchestrator_delta"; text: string }
  | { type: "answer_delta"; text: string }
  | { type: "result"; payload: AgentAnswer }
  | { type: "error"; message: string };

/** Callback z runBackOfficeAgent pro server-sent fáze. */
export type AgentRunProgress = {
  phase: string;
};
