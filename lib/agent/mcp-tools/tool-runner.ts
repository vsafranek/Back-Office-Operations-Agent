import type { AgentToolContext } from "@/lib/agent/types";
import { serializeForTrace } from "@/lib/agent/trace/serialize-for-trace";
import { logger } from "@/lib/observability/logger";
import type { McpTool } from "./types";

export class ToolRunner {
  private tools: Record<string, McpTool<unknown, unknown>>;

  constructor(tools: Record<string, McpTool<unknown, unknown>>) {
    this.tools = tools;
  }

  async run<TOutput>(toolName: string, ctx: AgentToolContext, input: unknown): Promise<TOutput> {
    const tool = this.tools[toolName];
    if (!tool) throw new Error(`TOOL_NOT_FOUND: ${toolName}`);

    // Validate input
    const parsedInput = tool.contract.inputSchema.parse(input);

    logger.info("tool_call_started", {
      toolName,
      runId: ctx.runId,
      userId: ctx.userId
    });

    const t0 = Date.now();
    try {
      const rawOutput = await tool.run(ctx, parsedInput);
      const output = tool.contract.outputSchema.parse(rawOutput);
      const durationMs = Date.now() - t0;

      void ctx.trace?.record({
        parentId: ctx.traceParentId ?? null,
        kind: "tool",
        name: toolName,
        input: serializeForTrace(parsedInput),
        output: serializeForTrace(output),
        durationMs
      });

      logger.info("tool_call_finished", {
        toolName,
        runId: ctx.runId,
        userId: ctx.userId,
        durationMs
      });

      return output as TOutput;
    } catch (error) {
      const durationMs = Date.now() - t0;
      const message = error instanceof Error ? error.message : "Unknown tool error";
      void ctx.trace?.record({
        parentId: ctx.traceParentId ?? null,
        kind: "tool",
        name: toolName,
        status: "error",
        input: serializeForTrace(parsedInput),
        output: null,
        errorMessage: message,
        durationMs
      });
      throw error;
    }
  }
}

