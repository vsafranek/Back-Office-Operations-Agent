import { type AgentAnswer, type AgentToolContext, agentArtifactStoragePathKey } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";
import { getPresentationOpeningTitleSlideForUser } from "@/lib/settings/user-ui-preferences";

export async function runWeeklyReportSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  slideCount: number;
  question: string;
  title: string;
  onAnswerDelta?: (chunk: string) => void | Promise<void>;
}): Promise<AgentAnswer> {
  const storageKey = agentArtifactStoragePathKey(params.ctx);
  const includeOpeningTitleSlide = await getPresentationOpeningTitleSlideForUser(params.ctx.userId);
  const totalSlidesLabel = includeOpeningTitleSlide ? params.slideCount + 1 : params.slideCount;
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

  const presentationContext = [
    `Pozadavek uzivatele: ${params.question}`,
    `Nazev vystupniho baliku: ${params.title}`,
    `Titulni uvodni slide: ${includeOpeningTitleSlide ? "ano" : "ne"}. Obsahovych slidu: ${params.slideCount}, celkem stran: ${totalSlidesLabel}.`
  ]
    .join("\n")
    .slice(0, 2000);

  const presentation = await params.toolRunner.run<{ publicUrl: string; pdfPublicUrl: string }>(
    "runPresentationAgent",
    params.ctx,
    {
      runId: storageKey,
      title: params.title,
      rows: data.rows,
      context: presentationContext,
      slideCount: params.slideCount,
      includeOpeningTitleSlide
    }
  );

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
      `Pocet slidu prezentace: ${totalSlidesLabel} celkem (${params.slideCount} obsah${includeOpeningTitleSlide ? " + titulek" : ", bez titulniho slidu"})`,
      `Datovy zdroj: ${data.source}, radku: ${data.rows.length}`,
      "Ukazka dat (JSON, max 15 radku):",
      JSON.stringify(data.rows.slice(0, 15), null, 2),
      `Odkazy: CSV ${report.csvPublic}, Markdown ${report.mdPublic}, Excel ${report.xlsxPublic}, PPTX ${presentation.publicUrl}, PDF ${presentation.pdfPublicUrl}`,
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
      { type: "table", label: "Excel workbook", url: report.xlsxPublic },
      { type: "presentation", label: `Prezentace (${totalSlidesLabel} slidu) PPTX`, url: presentation.publicUrl },
      { type: "presentation", label: `Prezentace (${totalSlidesLabel} slidu) PDF`, url: presentation.pdfPublicUrl }
    ],
    next_actions: reply.next_actions
  };
}
