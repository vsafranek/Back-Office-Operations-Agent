export async function enqueueWorkflowTask(params: {
  endpoint: string;
  payload: Record<string, unknown>;
}) {
  const response = await fetch(params.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(params.payload)
  });

  if (!response.ok) {
    throw new Error(`Workflow task enqueue failed (${response.status}).`);
  }

  return response.json();
}
