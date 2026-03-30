import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";

vi.mock("@/lib/llm/azure-proxy-provider", () => ({
  generateWithAzureProxy: vi.fn()
}));

import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { runScheduledTaskProposalSubAgent } from "@/lib/agent/subagents/scheduled-task-proposal-subagent";

describe("runScheduledTaskProposalSubAgent", () => {
  beforeEach(() => {
    vi.mocked(generateWithAzureProxy).mockReset();
  });

  it("writes execution intent marker into scheduled system prompt", async () => {
    vi.mocked(generateWithAzureProxy).mockResolvedValueOnce({
      text: JSON.stringify({
        title: "Ranni monitoring nabidek",
        cron_expression: "0 8 * * *",
        timezone: "Europe/Prague",
        system_prompt: "Soustred se na nove byty v Holesovicich.",
        user_question: "Najdi nove inzeraty.",
        agent_id: "thinking-orchestrator",
        execution_intent: "market_listings",
        market_listings_params: { location: "Praha Holešovice", sources: ["sreality", "bezrealitky"] }
      }),
      model: "mock"
    });

    const run = vi.fn(async (_key: string, _ctx: AgentToolContext, input: { system_prompt: string }) => ({
      message: "ok",
      draft: {
        title: "Ranni monitoring nabidek",
        cron_expression: "0 8 * * *",
        timezone: "Europe/Prague",
        system_prompt: input.system_prompt,
        user_question: "Najdi nove inzeraty.",
        agent_id: "thinking-orchestrator",
        market_listings_params: { location: "Praha Holešovice", sources: ["sreality", "bezrealitky"] }
      }
    }));
    const toolRunner = { run } as unknown as ToolRunner;

    const answer = await runScheduledTaskProposalSubAgent({
      toolRunner,
      ctx: { runId: "r1", userId: "u1" },
      question: "Kazde rano mi hlas nove nabidky v Praze Holesovice.",
      contextText: ""
    });

    expect(run).toHaveBeenCalledOnce();
    const toolInput = run.mock.calls[0]?.[2] as { system_prompt: string };
    expect(toolInput.system_prompt).toContain("[[SCHEDULED_EXECUTION_INTENT:market_listings]]");
    expect(toolInput.system_prompt).toContain("Soustred se na nove byty v Holesovicich.");
    expect(answer.dataPanel?.kind).toBe("scheduled_task_confirmation");
  });
});
