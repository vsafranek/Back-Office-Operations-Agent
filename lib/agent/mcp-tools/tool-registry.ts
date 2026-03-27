import type { AgentDefinition } from "@/lib/agent/config/types";
import {
  buildFullMcpToolMap,
  buildRestrictedMcpToolMap,
  type McpToolRegistryKey
} from "@/lib/agent/mcp-tools/config/assemble-registry";
import { ToolRunner } from "./tool-runner";

export type { McpToolRegistryKey };

let cachedFullRunner: ToolRunner | null = null;
const restrictedRunnerCache = new Map<string, ToolRunner>();

/** Kompletni MCP registry (vsechny nastroje + listMcpCapabilities nad celou mnozinou). Pro testy a diagnostiku. */
export function getFullMcpToolRunner(): ToolRunner {
  if (!cachedFullRunner) {
    cachedFullRunner = new ToolRunner(buildFullMcpToolMap() as any);
  }
  return cachedFullRunner;
}

/**
 * Omezeny runner podle konfigurace agenta — volitelne jen vybrane nastroje + listMcpCapabilities.
 */
export function getMcpToolRunnerForAgent(def: Pick<AgentDefinition, "id" | "availableMcpTools">): ToolRunner {
  const sig = `${def.id}::${def.availableMcpTools.slice().sort().join(",")}`;
  let runner = restrictedRunnerCache.get(sig);
  if (!runner) {
    runner = new ToolRunner(buildRestrictedMcpToolMap(def.availableMcpTools) as any);
    restrictedRunnerCache.set(sig, runner);
  }
  return runner;
}

/** Zachovan alias pro existujici volani (plna mnozina nastroju). */
export function getToolRunner() {
  return getFullMcpToolRunner();
}
