export type AgentTraceEventRow = {
  id: string;
  run_id: string;
  user_id: string;
  conversation_id: string | null;
  parent_id: string | null;
  step_index: number;
  kind: string;
  name: string;
  status: string;
  input_payload: unknown;
  output_payload: unknown;
  error_message: string | null;
  duration_ms: number | null;
  meta: Record<string, unknown>;
  created_at: string;
};
