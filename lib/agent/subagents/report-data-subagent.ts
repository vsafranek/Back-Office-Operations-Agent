import { agentArtifactStoragePathKey, type AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";

export type ReportDataSubAgentOutput = {
  rows: Record<string, unknown>[];
  source: string;
  report: {
    csvPublic: string;
    mdPublic: string;
    xlsxPublic: string;
  };
};

/**
 * Datovy/report task:
 * 1) nacte tabulkova data pres SQL preset
 * 2) vygeneruje report artefakty (CSV/MD/XLSX)
 */
export async function runReportDataSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  question: string;
  title: string;
}): Promise<ReportDataSubAgentOutput> {
  const storageKey = agentArtifactStoragePathKey(params.ctx);
  const data = await params.toolRunner.run<{ rows: Record<string, unknown>[]; source: string }>("runSqlPreset", params.ctx, {
    question: params.question,
    runId: storageKey
  });

  const report = await params.toolRunner.run<{ csvPublic: string; mdPublic: string; xlsxPublic: string }>(
    "generateReportArtifacts",
    params.ctx,
    {
      runId: storageKey,
      title: params.title,
      rows: data.rows
    }
  );

  return {
    rows: data.rows,
    source: data.source,
    report
  };
}
