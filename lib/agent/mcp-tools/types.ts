import type { ZodType } from "zod";

export type ToolAuthMode = "none" | "user" | "service-role";

export type McpToolContract<I, O> = {
  name: string;
  description: string;
  inputSchema: ZodType<I>;
  outputSchema: ZodType<O>;
  auth: ToolAuthMode;
  sideEffects: string[];
  errorModel?: unknown;
};

export type McpTool<I, O> = {
  contract: McpToolContract<I, O>;
  run: (ctx: { runId: string; userId: string }, input: I) => Promise<O>;
};

