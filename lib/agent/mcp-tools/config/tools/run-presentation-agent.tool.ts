import { z } from "zod";
import { generatePresentationArtifact, presentationToolContract } from "@/lib/agent/tools/presentation-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";

type PresentationIn = z.infer<typeof presentationToolContract.inputSchema>;
type PresentationOut = z.infer<typeof presentationToolContract.outputSchema>;

const tool: McpTool<PresentationIn, PresentationOut> = {
  contract: {
    ...presentationToolContract
  } as McpTool<PresentationIn, PresentationOut>["contract"],
  run: async (_ctx: AgentToolContext, input) => generatePresentationArtifact(input) as Promise<PresentationOut>
};

export const runPresentationAgentTool: McpToolConfigEntry = {
  registryKey: "runPresentationAgent",
  tool: tool as McpTool<unknown, unknown>
};
