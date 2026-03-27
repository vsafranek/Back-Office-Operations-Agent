import { describe, expect, it } from "vitest";
import { getMcpToolRunnerForAgent } from "@/lib/agent/mcp-tools/tool-registry";
import type { AgentToolContext } from "@/lib/agent/types";

const dummyCtx: AgentToolContext = {
  runId: "test-restricted-runner",
  userId: "u1",
  conversationId: null,
  trace: undefined,
  traceParentId: null
};

describe("getMcpToolRunnerForAgent", () => {
  it("exposes only allowed tools to listMcpCapabilities", async () => {
    const runner = getMcpToolRunnerForAgent({
      id: "test-agent",
      availableMcpTools: ["runSqlPreset", "webSearch"]
    });
    const out = await runner.run<{ capabilities: Array<{ name: string }> }>("listMcpCapabilities", dummyCtx, {});
    const names = out.capabilities.map((c) => c.name).sort();
    expect(names).toEqual(["listMcpCapabilities", "runSqlPreset", "webSearch"].sort());
  });

  it("throws when calling a tool outside the allowlist", async () => {
    const runner = getMcpToolRunnerForAgent({
      id: "narrow",
      availableMcpTools: ["runSqlPreset"]
    });
    await expect(
      runner.run("createEmailDraft", dummyCtx, {
        userId: "u",
        to: "a@b.c",
        subject: "hi",
        body: "x"
      })
    ).rejects.toThrow(/TOOL_NOT_FOUND/);
  });
});
