import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";

function safeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function summarizeAnalytics(source: string, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "Nenalezena zadna data pro tento dotaz.";

  if (source === "vw_new_clients_q1") {
    const bySource = new Map<string, number>();
    for (const row of rows) {
      const key = safeText(row.source_channel) || "Neznamy zdroj";
      bySource.set(key, (bySource.get(key) ?? 0) + 1);
    }
    const lines = Array.from(bySource.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([channel, count]) => `- ${channel}: ${count}`)
      .join("\n");

    const sampleClients = rows
      .slice(0, 5)
      .map((row) => `- ${safeText(row.full_name) || "Klient"} (${safeText(row.source_channel) || "Neznamy zdroj"})`)
      .join("\n");

    return `Za 1. kvartal evidujeme ${rows.length} novych klientu.\n\nRozdeleni podle zdroje:\n${lines}\n\nPriklady klientu:\n${sampleClients}`;
  }

  if (source === "vw_leads_vs_sales_6m") {
    let totalLeads = 0;
    let totalSold = 0;
    const trendLines = rows
      .map((row) => {
        const leads = Number(row.leads_count ?? 0);
        const sold = Number(row.sold_count ?? 0);
        totalLeads += leads;
        totalSold += sold;
        return `- ${safeText(row.month)}: leads ${leads}, prodane ${sold}`;
      })
      .join("\n");

    return `Za poslednich 6 mesicu: leads ${totalLeads}, prodane nemovitosti ${totalSold}.\n\nMesicni vyvoj:\n${trendLines}`;
  }

  if (source === "fn_missing_reconstruction_data()") {
    const list = rows
      .slice(0, 20)
      .map((row) => `- ${safeText(row.title)} (${safeText(row.city)})`)
      .join("\n");

    return `Nalezeno ${rows.length} nemovitosti s chybejicimi udaji o rekonstrukci/stavebnich upravach.\n\nSeznam k doplneni:\n${list}`;
  }

  return `Nalezeno ${rows.length} radku dat.`;
}

export async function runAnalyticsSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  question: string;
}): Promise<AgentAnswer> {
  const data = await params.toolRunner.run<{ rows: Record<string, unknown>[]; source: string }>("runSqlPreset", params.ctx, {
    question: params.question,
    runId: params.ctx.runId
  });

  const report = await params.toolRunner.run<{ csvPublic: string; mdPublic: string }>("generateReportArtifacts", params.ctx, {
    runId: params.ctx.runId,
    title: "Ad-hoc analyticky vystup",
    rows: data.rows
  });

  return {
    answer_text: summarizeAnalytics(data.source, data.rows),
    confidence: data.rows.length > 0 ? 0.86 : 0.55,
    sources: [data.source],
    generated_artifacts: [
      { type: "table", label: "Dataset CSV", url: report.csvPublic },
      { type: "chart", label: "Summary markdown", url: report.mdPublic }
    ],
    next_actions:
      data.rows.length === 0
        ? ["Dopln data ve zdrojovych tabulkach a spust dotaz znovu."]
        : ["Mohu rovnou pripravit executive report."]
  };
}

