import type { ZodType } from "zod";

export type ToolAuthMode = "none" | "user" | "service-role";

/** Obecny MCP kontrakt: `tool` = atomicka operace, `subagent` = specialista s vlastnim ukolem (stejna forma volani). */
export type McpToolRole = "tool" | "subagent";

export type McpToolContract<I, O> = {
  name: string;
  description: string;
  inputSchema: ZodType<I>;
  outputSchema: ZodType<O>;
  auth: ToolAuthMode;
  sideEffects: string[];
  /** Vyplnit u specialistu (napr. prezentace); jinak implicitne tool pri exportu capabilities. */
  role?: McpToolRole;
  errorModel?: unknown;
};

export type McpTool<I, O> = {
  contract: McpToolContract<I, O>;
  run: (ctx: { runId: string; userId: string }, input: I) => Promise<O>;
};

