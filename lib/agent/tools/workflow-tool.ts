import { recordExternalWorkflowEnqueue } from "@/lib/integrations/workflow-enqueue-audit";

export async function enqueueWorkflowTask(params: {
  endpoint: string;
  payload: Record<string, unknown>;
  /** Korelace pro zápis do workflow_runs (BOA-007). */
  agentContext?: { runId: string; userId: string; conversationId?: string | null };
}) {
  const response = await fetch(params.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(params.payload)
  });

  const text = await response.text();
  let responsePreview: unknown = text.slice(0, 2000);
  if (response.ok) {
    try {
      responsePreview = JSON.parse(text) as unknown;
    } catch {
      /* keep string preview */
    }
  }

  await recordExternalWorkflowEnqueue({
    endpoint: params.endpoint,
    payload: params.payload,
    httpStatus: response.status,
    ok: response.ok,
    errorText: response.ok ? null : text.slice(0, 4000),
    responsePreview: response.ok ? responsePreview : undefined,
    agentContext: params.agentContext
  });

  if (!response.ok) {
    throw new Error(`Workflow task enqueue failed (${response.status}).`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 5000) };
  }
}
