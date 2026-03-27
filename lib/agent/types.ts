import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";

export type AgentArtifact = {
  type: "chart" | "table" | "report" | "presentation" | "email";
  label: string;
  url?: string;
  content?: string;
};

export type AgentOrchestrationMeta = {
  agentId: string;
  mode: "basic" | "thinking";
  /** K dispozici u režimu thinking – stručná úvaha před výběrem intentu. */
  reasoning?: string;
};

/** Strukturovaná data pro pravý panel dashboardu (tabulka + volitelný graf). */
export type AgentDataPanel =
  | {
      kind: "clients_q1";
      source: string;
      rows: Record<string, unknown>[];
      chart: { title: string; labels: string[]; values: number[] };
    }
  | {
      kind: "clients_filtered";
      source: string;
      /** Nadpis nad tabulkou (např. vyhledaná oblast). */
      title: string;
      rows: Record<string, unknown>[];
    };

export type AgentAnswer = {
  /** Korelace s řádky v agent_trace_events; doplní `runBackOfficeAgent`. */
  runId?: string;
  answer_text: string;
  confidence: number;
  sources: string[];
  generated_artifacts: AgentArtifact[];
  next_actions: string[];
  orchestration?: AgentOrchestrationMeta;
  /** Volitelné: vykreslení v UI (např. analytics Q1 klienti). */
  dataPanel?: AgentDataPanel;
};

export type AgentToolContext = {
  runId: string;
  userId: string;
  conversationId?: string | null;
  trace?: AgentTraceRecorder;
  traceParentId?: string | null;
};

/** Řádek NDJSON z POST /api/agent/stream. */
export type AgentStreamLine =
  | { type: "phase"; label: string }
  | { type: "orchestrator_delta"; text: string }
  | { type: "result"; payload: AgentAnswer }
  | { type: "error"; message: string };

/** Callback z runBackOfficeAgent pro server-sent fáze. */
export type AgentRunProgress = {
  phase: string;
};
