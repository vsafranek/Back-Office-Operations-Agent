import type { AgentAnswer, AgentStreamLine } from "@/lib/agent/types";

export type AgentStreamReaderOptions = {
  onPhase?: (label: string) => void;
  onOrchestratorDelta?: (chunk: string) => void;
};

/**
 * Čte tělo odpovědi z POST /api/agent/stream (NDJSON: jeden JSON objekt na řádek).
 */
export async function readAgentNdjsonStream(
  response: Response,
  options?: AgentStreamReaderOptions
): Promise<AgentAnswer> {
  const body = response.body;
  if (!body) {
    throw new Error("Chybí tělo streamované odpovědi.");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer: AgentAnswer | null = null;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parsed = JSON.parse(trimmed) as AgentStreamLine;
    if (parsed.type === "phase") {
      options?.onPhase?.(parsed.label);
      return;
    }
    if (parsed.type === "orchestrator_delta") {
      options?.onOrchestratorDelta?.(parsed.text);
      return;
    }
    if (parsed.type === "error") {
      throw new Error(parsed.message);
    }
    if (parsed.type === "result") {
      answer = parsed.payload;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        handleLine(line);
      }
    }
    if (buffer.trim()) {
      handleLine(buffer);
    }
  } finally {
    reader.releaseLock();
  }

  if (!answer) {
    throw new Error("Stream skončil bez výsledné odpovědi.");
  }
  return answer;
}
