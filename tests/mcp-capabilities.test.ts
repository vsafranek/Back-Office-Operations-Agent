import { describe, expect, it } from "vitest";
import { getToolRunner } from "@/lib/agent/mcp-tools/tool-registry";
import type { AgentToolContext } from "@/lib/agent/types";

const dummyCtx: AgentToolContext = {
  runId: "test-run-capabilities",
  userId: "test-user",
  conversationId: null,
  trace: undefined,
  traceParentId: null
};

describe("listMcpCapabilities", () => {
  it("returns all tools including runPresentationAgent and self", async () => {
    const runner = getToolRunner();
    const out = await runner.run<{
      capabilities: Array<{ name: string; role: string; inputJsonSchema?: unknown }>;
    }>("listMcpCapabilities", dummyCtx, {});

    const names = out.capabilities.map((c) => c.name).sort();
    expect(names).toContain("listMcpCapabilities");
    expect(names).toContain("runPresentationAgent");
    expect(names).toContain("runSqlPreset");

    const pres = out.capabilities.find((c) => c.name === "runPresentationAgent");
    expect(pres?.role).toBe("subagent");
    expect(pres?.inputJsonSchema).toBeDefined();

    const onlySub = await runner.run<{ capabilities: Array<{ role: string }> }>("listMcpCapabilities", dummyCtx, {
      onlySubagents: true
    });
    expect(onlySub.capabilities.every((c) => c.role === "subagent")).toBe(true);
  });
});
