import { AgentTraceRecorder } from "@/lib/agent/trace/recorder";

/**
 * Jednotný handle jednoho běhu agenta (korelace logů, trace, budoucí limity tokenů).
 */
export type AgentRunHandle = {
  runId: string;
  userId: string;
  conversationId: string | null;
  trace: AgentTraceRecorder;
};

export function createAgentRunHandle(input: {
  runId: string;
  userId: string;
  conversationId: string | null;
}): AgentRunHandle {
  return {
    runId: input.runId,
    userId: input.userId,
    conversationId: input.conversationId,
    trace: new AgentTraceRecorder({
      runId: input.runId,
      userId: input.userId,
      conversationId: input.conversationId
    })
  };
}
