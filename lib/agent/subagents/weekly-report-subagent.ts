import { type AgentAnswer, type AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";
import { runReportDataSubAgent } from "@/lib/agent/subagents/report-data-subagent";
import { runPresentationFromRowsSubAgent } from "@/lib/agent/subagents/presentation-subagent";

export async function runWeeklyReportSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  slideCount: number;
  question: string;
  title: string;
  onAnswerDelta?: (chunk: string) => void | Promise<void>;
}): Promise<AgentAnswer> {
  // Task 1: datovy/report subagent pripravi tabulku + CSV/MD/XLSX.
  const reportTask = await runReportDataSubAgent({
    toolRunner: params.toolRunner,
    ctx: params.ctx,
    question: params.question,
    title: params.title
  });

  // Task 2: prezentační subagent dostane stejná data a vytvoří deck.
  const presentationTask = await runPresentationFromRowsSubAgent({
    toolRunner: params.toolRunner,
    ctx: params.ctx,
    slideCount: params.slideCount,
    question: params.question,
    title: params.title,
    rows: reportTask.rows,
    sourceLabel: reportTask.source
  });

  const reply = await generateUserFacingReply({
    runId: params.ctx.runId,
    maxTokens: 1000,
    trace: params.ctx.trace
      ? {
          recorder: params.ctx.trace,
          parentId: params.ctx.traceParentId ?? null,
          name: "llm.subagent.weekly-report.reply"
        }
      : undefined,
    onAnswerDelta: params.onAnswerDelta,
    userContent: [
      `Pozadavek uzivatele: ${params.question}`,
      `Nazev baliku vystupu: ${params.title}`,
      `Pocet slidu prezentace: ${presentationTask.totalSlidesLabel} celkem (${params.slideCount} obsah${
        presentationTask.includeOpeningTitleSlide ? " + titulek" : ", bez titulniho slidu"
      })`,
      `Datovy zdroj: ${reportTask.source}, radku: ${reportTask.rows.length}`,
      "Ukazka dat (JSON, max 15 radku):",
      JSON.stringify(reportTask.rows.slice(0, 15), null, 2),
      `Odkazy: CSV ${reportTask.report.csvPublic}, Markdown ${reportTask.report.mdPublic}, Excel ${reportTask.report.xlsxPublic}, PPTX ${presentationTask.publicUrl}, PDF ${presentationTask.pdfPublicUrl}`,
      "Popis uzivateli strucne co bylo vygenerovano a co ma zkontrolovat; odvozuj jen z udaju vyse."
    ].join("\n\n")
  });

  return {
    answer_text: reply.answer_text,
    confidence: reply.confidence,
    sources: [reportTask.source],
    generated_artifacts: [
      { type: "report", label: "CSV dataset", url: reportTask.report.csvPublic },
      { type: "report", label: "Markdown summary", url: reportTask.report.mdPublic },
      { type: "table", label: "Excel workbook", url: reportTask.report.xlsxPublic },
      { type: "presentation", label: `Prezentace (${presentationTask.totalSlidesLabel} slidu) PPTX`, url: presentationTask.publicUrl },
      { type: "presentation", label: `Prezentace (${presentationTask.totalSlidesLabel} slidu) PDF`, url: presentationTask.pdfPublicUrl }
    ],
    next_actions: reply.next_actions
  };
}
