import { z } from "zod";
import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";

const SplitSchema = z.object({
  tasks: z.array(z.string().min(2)).min(1).max(6)
});

/** Levná heuristiková brána před LLM — krátké jednoúčelové dotazy nerozsekávat. */
export function shouldAttemptCompoundQuestionSplit(question: string): boolean {
  const q = question.trim();
  if (q.length < 12) return false;
  const qmarks = (q.match(/\?/g) ?? []).length;
  if (qmarks >= 2) return true;
  if (/(\n\s*\n|;\s*\S|•\s+\S)/.test(q)) return true;
  if (/\b(a tak[eé]|a jeste|a ještě|plus|nav[ií]c|krom[eě] toho)\b/i.test(q)) return true;
  return q.length > 200;
}

/**
 * Rozloží jednu uživatelskou zprávu na nezávislé podúlohy, nebo vrátí jeden prvek.
 * Jedna soudržná analytická otázka musí zůstat v jednom tasku (řízeno LLM).
 */
export async function splitCompoundUserTasks(params: {
  question: string;
  runId: string;
  trace?: { recorder: AgentTraceRecorder; parentId: string | null };
}): Promise<string[]> {
  const q = params.question.trim();
  if (!shouldAttemptCompoundQuestionSplit(q)) return [q];

  const traceParams = params.trace
    ? { recorder: params.trace.recorder, parentId: params.trace.parentId, name: "llm.compound_question.split" as const }
    : undefined;

  const system = [
    "Uzivatel napsal jednu nebo vice nezavislich pracovnich otazek v jedne zprave (cesky).",
    'Vrat POUZE JSON tvaru {"tasks":["...","..."]}.',
    "Pravidla:",
    "- Pokud jde o JEDNU souvislou otazku (vcetne vice vet o stejnem tematu, napr. Q1 klienti + odkud prisli + graf v aplikaci), vrat presne JEDEN prvek v \"tasks\" — cele zadani v jednom retezci.",
    "- Rozdel jen pri opravdu oddelenych ukolech (napr. SQL analytika + jiny ukol jako e-mail nebo nastaveni cronu).",
    "- Maximalne 6 ukolu; kazdy srozumitelny sam o sobe; poradi jako u uzivatele."
  ].join("\n");

  let llm = await generateWithAzureProxy({
    runId: params.runId,
    maxTokens: 400,
    trace: traceParams,
    messages: [
      { role: "system", content: system },
      { role: "user", content: q }
    ]
  });

  let parsed = tryParseJsonObject(SplitSchema, llm.text);
  if (!parsed) {
    llm = await generateWithAzureProxy({
      runId: params.runId,
      maxTokens: 320,
      trace: traceParams
        ? { ...traceParams, name: "llm.compound_question.split.repair" as const }
        : undefined,
      messages: [
        {
          role: "system",
          content: "Predchozi vystup nebyl validni JSON. Oprav na jediny objekt {\"tasks\":[...]} bez markdownu."
        },
        { role: "user", content: llm.text }
      ]
    });
    parsed = tryParseJsonObject(SplitSchema, llm.text);
  }

  if (!parsed) return [q];

  const tasks = parsed.tasks.map((t) => t.trim()).filter((t) => t.length >= 2);
  return tasks.length > 0 ? tasks : [q];
}
