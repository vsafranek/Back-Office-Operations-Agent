import { logger } from "@/lib/observability/logger";
import type { McpTool } from "./types";

export class ToolRunner {
  private tools: Record<string, McpTool<unknown, unknown>>;

  constructor(tools: Record<string, McpTool<unknown, unknown>>) {
    this.tools = tools;
  }

  async run<TOutput>(toolName: string, ctx: { runId: string; userId: string }, input: unknown): Promise<TOutput> {
    const tool = this.tools[toolName];
    if (!tool) throw new Error(`TOOL_NOT_FOUND: ${toolName}`);

    // Validate input
    const parsedInput = tool.contract.inputSchema.parse(input);

    logger.info("tool_call_started", {
      toolName,
      runId: ctx.runId,
      userId: ctx.userId
    });

    const rawOutput = await tool.run(ctx, parsedInput);

    // Validate output
    const output = tool.contract.outputSchema.parse(rawOutput);

    logger.info("tool_call_finished", {
      toolName,
      runId: ctx.runId,
      userId: ctx.userId
    });

    return output as TOutput;
  }
}

