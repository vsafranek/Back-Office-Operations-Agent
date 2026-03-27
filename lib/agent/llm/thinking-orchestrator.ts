import { z } from "zod";
import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";
import type { ClassifiedAgentIntent } from "@/lib/agent/llm/intent-classifier";

const ThinkingOrchestratorSchema = z.object({
  reasoning: z.string().min(1),
  intent: z.enum(["analytics", "calendar_email", "presentation", "weekly_report", "web_search"]),
  slideCount: z.number().int().min(2).max(15).optional()
});

export type ThinkingOrchestratorResult = ClassifiedAgentIntent & {
  reasoning: string;
};

export async function classifyWithThinkingOrchestrator(params: {
  runId: string;
  question: string;
  contextText?: string;
  extraInstructions?: string;
  trace?: { recorder: AgentTraceRecorder; parentId: string | null };
}): Promise<ThinkingOrchestratorResult> {
  const history = params.contextText?.trim()
    ? `\n\nKontext poslednich zprav:\n${params.contextText}`
    : "";

  const extra = params.extraInstructions?.trim() ? `\n\nDodatecne pokyny orchestratora:\n${params.extraInstructions}` : "";

  const systemPrompt =
    "Jsi orchestrator back-office agenta pro realitni firmu.\n" +
    "Nejdrive proved uvahu (reasoning): 3–8 vet v cestine, co uzivatel chce, jaka je sporna mista a ktery typ ulohy to je.\n" +
    "Pak v jedinem JSON objektu (bez markdownu) vrat:\n" +
    '{"reasoning":"<tva uvaha jako jeden retezec>","intent":"analytics"|"calendar_email"|"presentation"|"weekly_report"|"web_search","slideCount":<volitelne 2-15>}\n' +
    "intent:\n" +
    "- analytics: interni data, KPI, SQL vystup — predevsim tabulka a prehled, ne hlavni PPTX.\n" +
    "- calendar_email: e-mail, prohlidka, kalendář, draft do Gmailu.\n" +
    "- presentation: predevsim slidova prezentace / PPTX z dat, bez celeho balicku CSV+MD+prezentace.\n" +
    "- weekly_report: komplexni manazersky balicek — CSV, Markdown a prezentace.\n" +
    "- web_search: overeni na internetu mimo interni data.\n" +
    "slideCount u presentation nebo weekly_report jen pokud uzivatel explicitne zminil pocet slidu; jinak pole vynechej.\n" +
    "V poli reasoning strucne shrn duvod pro vybrany intent.";

  const ask = async (traceName: "llm.orchestrator.thinking" | "llm.orchestrator.thinking.repair") =>
    generateWithAzureProxy({
      runId: params.runId,
      maxTokens: traceName === "llm.orchestrator.thinking" ? 900 : 700,
      trace: params.trace
        ? { recorder: params.trace.recorder, parentId: params.trace.parentId, name: traceName }
        : undefined,
      messages: [
        { role: "system", content: systemPrompt + extra },
        { role: "user", content: `Pozadavek uzivatele:\n${params.question}${history}` }
      ]
    });

  let llm = await ask("llm.orchestrator.thinking");
  let parsed = tryParseJsonObject(ThinkingOrchestratorSchema, llm.text);
  if (parsed) {
    if (params.trace?.recorder && llm.traceEventId) {
      void params.trace.recorder.record({
        parentId: llm.traceEventId,
        kind: "orchestrator",
        name: "thinking.parsed",
        output: {
          intent: parsed.intent,
          slideCount: parsed.slideCount,
          reasoning: parsed.reasoning.trim().slice(0, 8000)
        }
      });
    }
    return { intent: parsed.intent, slideCount: parsed.slideCount, reasoning: parsed.reasoning.trim() };
  }

  llm = await generateWithAzureProxy({
    runId: params.runId,
    maxTokens: 700,
    trace: params.trace
      ? { recorder: params.trace.recorder, parentId: params.trace.parentId, name: "llm.orchestrator.thinking.repair" }
      : undefined,
    messages: [
      {
        role: "system",
        content:
          "Predchozi odpoved nebyla platnym JSON. Vrat pouze jeden JSON objekt {reasoning, intent, slideCount?} podle pravidel z predchozi zpravy."
      },
      { role: "user", content: llm.text }
    ]
  });
  parsed = tryParseJsonObject(ThinkingOrchestratorSchema, llm.text);
  if (parsed) {
    if (params.trace?.recorder && llm.traceEventId) {
      void params.trace.recorder.record({
        parentId: llm.traceEventId,
        kind: "orchestrator",
        name: "thinking.parsed",
        output: {
          intent: parsed.intent,
          slideCount: parsed.slideCount,
          reasoning: parsed.reasoning.trim().slice(0, 8000)
        }
      });
    }
    return { intent: parsed.intent, slideCount: parsed.slideCount, reasoning: parsed.reasoning.trim() };
  }

  return {
    intent: "analytics",
    reasoning: "Model nevratil strukturovany JSON; spustena zalozni vetev analytics."
  };
}
