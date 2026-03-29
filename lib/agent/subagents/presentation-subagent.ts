import { type AgentAnswer, type AgentToolContext, agentArtifactStoragePathKey } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";
import { getPresentationOpeningTitleSlideForUser } from "@/lib/settings/user-ui-preferences";

/**
 * Prezentacni specialista: nacte data pres SQL preset a vygeneruje PPTX + PDF pres MCP runPresentationAgent.
 * Orchestrator nebo jiny koordinator ho vola jako subagent (intent presentation).
 */
export async function runPresentationSubAgent(params: {
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

  const presentationContext = [
    `Ukol k prezentaci: ${params.question}`,
    `Nazev decku: ${params.title}`,
    `Titulni uvodni slide: ${includeOpeningTitleSlide ? "ano (+1 k poctu obsahovych)" : "ne (vsechny slidy obsahove)"}.`,
    `Pocet obsahovych slidu: ${params.slideCount}; celkem stran v decku: ${totalSlidesLabel}.`,
    `Datovy zdroj (preset): ${data.source}`,
    `Pocet radek: ${data.rows.length}`
  ]
    .join("\n")
    .slice(0, 2000);

  const presentation = await params.toolRunner.run<{
    publicUrl: string;
    pdfPublicUrl: string;
    storagePrefix?: string;
  }>("runPresentationAgent", params.ctx, {
    runId: storageKey,
    title: params.title,
    rows: data.rows,
    context: presentationContext,
    slideCount: params.slideCount,
    includeOpeningTitleSlide
  });

  const sampleRows = data.rows.slice(0, 15);
  const reply = await generateUserFacingReply({
    runId: params.ctx.runId,
    maxTokens: 1000,
    trace: params.ctx.trace
      ? {
          recorder: params.ctx.trace,
          parentId: params.ctx.traceParentId ?? null,
          name: "llm.subagent.presentation.reply"
        }
      : undefined,
    onAnswerDelta: params.onAnswerDelta,
    userContent: [
      `Puvodni pozadavek: ${params.question}`,
      `Deck: ${params.title}, obsahovych slidu: ${params.slideCount}, celkem stran: ${totalSlidesLabel}${includeOpeningTitleSlide ? " (vcetne titulku)" : " (bez titulniho slidu)"}.`,
      `Zdroj: ${data.source}, radku: ${data.rows.length}`,
      "Ukazka dat (JSON):",
      JSON.stringify(sampleRows, null, 2),
      `Odkazy: PPTX ${presentation.publicUrl}, PDF ${presentation.pdfPublicUrl}`,
      "Shrnut uzivateli, co prezentace obsahuje a co si ma otevrit."
    ].join("\n\n")
  });

  return {
    answer_text: reply.answer_text,
    confidence: reply.confidence,
    sources: [data.source],
    generated_artifacts: [
      { type: "presentation", label: `Prezentace (${totalSlidesLabel} slidu) PPTX`, url: presentation.publicUrl },
      { type: "presentation", label: `Prezentace (${totalSlidesLabel} slidu) PDF`, url: presentation.pdfPublicUrl }
    ],
    next_actions: reply.next_actions
  };
}
