import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";

export async function runWeeklyReportSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  slideCount: number;
  question: string;
  title: string;
}): Promise<AgentAnswer> {
  const data = await params.toolRunner.run<{ rows: Record<string, unknown>[]; source: string }>("runSqlPreset", params.ctx, {
    question: params.question,
    runId: params.ctx.runId
  });

  const report = await params.toolRunner.run<{ csvPublic: string; mdPublic: string }>("generateReportArtifacts", params.ctx, {
    runId: params.ctx.runId,
    title: params.title,
    rows: data.rows
  });

  const presentation = await params.toolRunner.run<{ publicUrl: string; pdfPublicUrl: string }>(
    "generatePresentationArtifact",
    params.ctx,
    {
      runId: params.ctx.runId,
      title: params.title,
      rows: data.rows,
      context: params.question,
      slideCount: params.slideCount
    }
  );

  const reply = await generateUserFacingReply({
    runId: params.ctx.runId,
    maxTokens: 1000,
    userContent: [
      `Pozadavek uzivatele: ${params.question}`,
      `Nazev baliku vystupu: ${params.title}`,
      `Pocet slidu prezentace: ${params.slideCount}`,
      `Datovy zdroj: ${data.source}, radku: ${data.rows.length}`,
      "Ukazka dat (JSON, max 15 radku):",
      JSON.stringify(data.rows.slice(0, 15), null, 2),
      `Odkazy: CSV ${report.csvPublic}, Markdown ${report.mdPublic}, PPTX ${presentation.publicUrl}, PDF ${presentation.pdfPublicUrl}`,
      "Popis uzivateli strucne co bylo vygenerovano a co ma zkontrolovat; odvozuj jen z udaju vyse."
    ].join("\n\n")
  });

  return {
    answer_text: reply.answer_text,
    confidence: reply.confidence,
    sources: [data.source],
    generated_artifacts: [
      { type: "report", label: "CSV dataset", url: report.csvPublic },
      { type: "report", label: "Markdown summary", url: report.mdPublic },
      { type: "presentation", label: `Prezentace (${params.slideCount} slidu) PPTX`, url: presentation.publicUrl },
      { type: "presentation", label: `Prezentace (${params.slideCount} slidu) PDF`, url: presentation.pdfPublicUrl }
    ],
    next_actions: reply.next_actions
  };
}
