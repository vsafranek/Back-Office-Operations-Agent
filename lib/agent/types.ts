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

export type AgentAnswer = {
  /** Korelace s řádky v agent_trace_events; doplní `runBackOfficeAgent`. */
  runId?: string;
  answer_text: string;
  confidence: number;
  sources: string[];
  generated_artifacts: AgentArtifact[];
  next_actions: string[];
  orchestration?: AgentOrchestrationMeta;
};

export type AgentToolContext = {
  runId: string;
  userId: string;
  conversationId?: string | null;
  trace?: AgentTraceRecorder;
  traceParentId?: string | null;
};
