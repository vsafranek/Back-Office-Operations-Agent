import { z } from "zod";
import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";
import { generateWithAzureProxy, streamWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";
import type { ClassifiedAgentIntent } from "@/lib/agent/llm/intent-classifier";

const INTENT_ENUM = [
  "analytics",
  "calendar_email",
  "presentation",
  "weekly_report",
  "web_search",
  "market_listings",
  "scheduled_agent_task",
  "casual_chat"
] as const;

const ThinkingOrchestratorSchema = z.object({
  reasoning: z.string().min(1),
  intent: z.enum(INTENT_ENUM),
  slideCount: z.number().int().min(1).max(14).optional()
});

const IntentOnlySchema = z.object({
  intent: z.enum(INTENT_ENUM),
  slideCount: z.number().int().min(1).max(14).optional()
});

export type ThinkingOrchestratorResult = ClassifiedAgentIntent & {
  reasoning: string;
};

function intentRulesBlock(): string {
  return (
    "intent:\n" +
    "- analytics: interni data, KPI, SQL — tabulka, souhrn, graf nad daty v aplikaci (slovo 'graf' u klientu/leadu = analytics).\n" +
    "- calendar_email: e-mail, prohlidka, kalendář, draft do Gmailu — dalsi krok je specialista na maily; v uvaze strucne vystihni JADRO zpravy (co ma klient dostat), formu nech na nem. " +
    "Pokud kontext ukazuje predchozi nabidku navrhu mailu / kandidatu na prijemce a uzivatel ted jen doplnuje e-mail nebo voli „prvni“/„druhy“ → calendar_email.\n" +
    "- presentation: hlavni vystup je PPTX / slidovy deck (PowerPoint), ne pouhy graf z databaze.\n" +
    "- weekly_report: komplexni manazersky balicek — CSV, Markdown a prezentace.\n" +
    "- market_listings: Sreality/Bezrealitky, jednorazovy dotaz na inzeraty (i „informuj me o nabidkach v …“) — neni SQL ani obecny webovy search.\n" +
    "- web_search: jen explicitni fakticky dotaz na verejny web (aktuality, cizi pojem) — NIKDY pozdrav, „jak se mas“, diky ani vyznam fraze.\n" +
    "- scheduled_agent_task: jen pri EXPLICITNIM opakovani v case (kazdy den, rano, pravidelne, cron, automaticky posilej…) nebo naplanovani ulohy. " +
    "Bez frekvence/casovani → market_listings, ne scheduled_agent_task.\n" +
    "- casual_chat: pozdrav, small talk, zdvorilost bez pracovniho ukolu — odpoved bez nastroju, ne web_search.\n" +
    "slideCount u presentation nebo weekly_report = pocet OBSAHOVYCH slidu (bez titulku), 1–14; titulek prida system. Pri explicitnim poctu (cislo nebo napr. tremi slidy); jinak pole vynechej.\n"
  );
}

function buildThinkingSystemPrompt(extra: string): string {
  return (
    "Jsi orchestrator back-office agenta pro realitni firmu.\n" +
    "Nejdrive proved uvahu (reasoning): 3–8 vet v cestine, co uzivatel chce, jaka je sporna mista a ktery typ ulohy to je.\n" +
    "Pak v jedinem JSON objektu (bez markdownu) vrat:\n" +
    '{"reasoning":"<tva uvaha jako jeden retezec>","intent":"analytics"|"calendar_email"|"presentation"|"weekly_report"|"web_search"|"market_listings"|"scheduled_agent_task"|"casual_chat","slideCount":<volitelne 1-14, obsahove slidy>}\n' +
    intentRulesBlock() +
    "V poli reasoning strucne shrn duvod pro vybrany intent." +
    extra
  );
}

async function thinkingOrchestratorStreamed(params: {
  runId: string;
  question: string;
  contextText?: string;
  extraInstructions?: string;
  trace?: { recorder: AgentTraceRecorder; parentId: string | null };
  onReasoningDelta: (chunk: string) => void | Promise<void>;
}): Promise<ThinkingOrchestratorResult> {
  const history = params.contextText?.trim()
    ? `\n\nKontext poslednich zprav:\n${params.contextText}`
    : "";

  const extra = params.extraInstructions?.trim() ? `\n\nDodatecne pokyny orchestratora:\n${params.extraInstructions}` : "";

  const reasoningSystem =
    "Jsi orchestrator back-office agenta pro realitni firmu.\n" +
    "Napis 3–8 vet v cestine: co uzivatel chce, pochybna mista, jaky typ ulohy (analytika, e-mail/kalendar, prezentace, report, web, casual_chat pri pozdravu/small talk bez ukolu).\n" +
    "Vrat POUZE souvisly text (bez JSON, bez odrzek, bez nadpisu)." +
    extra;

  const streamTrace = params.trace
    ? {
        recorder: params.trace.recorder,
        parentId: params.trace.parentId,
        name: "llm.orchestrator.thinking.reasoning_stream" as const
      }
    : undefined;

  const streamed = await streamWithAzureProxy({
    runId: params.runId,
    maxTokens: 600,
    trace: streamTrace,
    onTextDelta: (chunk) => {
      void params.onReasoningDelta(chunk);
    },
    messages: [
      { role: "system", content: reasoningSystem },
      { role: "user", content: `Pozadavek uzivatele:\n${params.question}${history}` }
    ]
  });

  const intentSystem =
    "Na zaklade zadani uzivatele a hotove uvahy asistenta (cesky) vrat POUZE jeden JSON objekt (bez markdownu):\n" +
    '{"intent":"analytics"|"calendar_email"|"presentation"|"weekly_report"|"web_search"|"market_listings"|"scheduled_agent_task"|"casual_chat","slideCount":<volitelne cislo 1-14 obsahovych slidu>}\n' +
    intentRulesBlock();

  const intentUser =
    `Pozadavek uzivatele:\n${params.question}${history}\n\n---\nUvaha asistenta:\n${streamed.text}`;

  let intentLlm = await generateWithAzureProxy({
    runId: params.runId,
    maxTokens: 220,
    trace: params.trace
      ? {
          recorder: params.trace.recorder,
          parentId: params.trace.parentId,
          name: "llm.orchestrator.thinking.intent_json"
        }
      : undefined,
    messages: [
      { role: "system", content: intentSystem },
      { role: "user", content: intentUser }
    ]
  });

  let parsed = tryParseJsonObject(IntentOnlySchema, intentLlm.text);
  if (!parsed) {
    intentLlm = await generateWithAzureProxy({
      runId: params.runId,
      maxTokens: 200,
      trace: params.trace
        ? {
            recorder: params.trace.recorder,
            parentId: params.trace.parentId,
            name: "llm.orchestrator.thinking.intent_json.repair"
          }
        : undefined,
      messages: [
        {
          role: "system",
          content:
            "Predchozi vystup nebyl platny JSON. Vrat pouze jeden objekt {intent, slideCount?} podle pravidel."
        },
        { role: "user", content: intentLlm.text }
      ]
    });
    parsed = tryParseJsonObject(IntentOnlySchema, intentLlm.text);
  }

  if (parsed) {
    if (params.trace?.recorder && intentLlm.traceEventId) {
      void params.trace.recorder.record({
        parentId: intentLlm.traceEventId,
        kind: "orchestrator",
        name: "thinking.parsed_from_stream",
        output: {
          intent: parsed.intent,
          slideCount: parsed.slideCount,
          reasoningPreview: streamed.text.slice(0, 8000)
        }
      });
    }
    return { intent: parsed.intent, slideCount: parsed.slideCount, reasoning: streamed.text.trim() };
  }

  return thinkingOrchestratorSinglePass({
    runId: params.runId,
    question: params.question,
    contextText: params.contextText,
    extraInstructions: params.extraInstructions,
    trace: params.trace
  });
}

async function thinkingOrchestratorSinglePass(params: {
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

  const systemPrompt = buildThinkingSystemPrompt(extra);

  const ask = async (traceName: "llm.orchestrator.thinking" | "llm.orchestrator.thinking.repair") =>
    generateWithAzureProxy({
      runId: params.runId,
      maxTokens: traceName === "llm.orchestrator.thinking" ? 900 : 700,
      trace: params.trace
        ? { recorder: params.trace.recorder, parentId: params.trace.parentId, name: traceName }
        : undefined,
      messages: [
        { role: "system", content: systemPrompt },
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

export async function classifyWithThinkingOrchestrator(params: {
  runId: string;
  question: string;
  contextText?: string;
  extraInstructions?: string;
  trace?: { recorder: AgentTraceRecorder; parentId: string | null };
  /** Když je nastaveno (např. /api/agent/stream), úvaha se streamuje token po tokenu. */
  onReasoningDelta?: (chunk: string) => void | Promise<void>;
}): Promise<ThinkingOrchestratorResult> {
  if (params.onReasoningDelta) {
    return thinkingOrchestratorStreamed({
      ...params,
      onReasoningDelta: params.onReasoningDelta
    });
  }
  return thinkingOrchestratorSinglePass(params);
}
