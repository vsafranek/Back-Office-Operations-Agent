/** Typy pro GET /api/audit/run — sdílené klient/server bez importu Supabase na klientovi. */

export type AgentRunRow = {
  run_id: string;
  user_id: string;
  question: string;
  intent: string;
  answer: string;
  confidence: number;
  sources: string[];
  created_at: string;
  finished_at: string | null;
};

export type OutboundEmailEventRow = {
  id: string;
  action: string;
  to_email: string;
  subject: string;
  body_excerpt: string | null;
  gmail_draft_id: string | null;
  gmail_message_id: string | null;
  conversation_id: string | null;
  agent_run_id: string | null;
  created_at: string;
  meta: Record<string, unknown>;
};

export type OutboundWithLeads = OutboundEmailEventRow & { leadIds: string[] };

export type AuditRunAggregate = {
  runId: string;
  agentRun: AgentRunRow | null;
  traceEventCount: number;
  traceSample: Array<{
    id: string;
    kind: string;
    name: string;
    status: string;
    duration_ms: number | null;
    created_at: string;
  }>;
  outboundEmails: OutboundWithLeads[];
};
