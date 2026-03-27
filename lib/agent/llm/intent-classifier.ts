import { z } from "zod";
import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";

const IntentSchema = z.object({
  intent: z.enum(["analytics", "calendar_email", "weekly_report", "web_search"]),
  slideCount: z.number().int().min(2).max(15).optional()
});

export type ClassifiedAgentIntent = z.infer<typeof IntentSchema>;

export async function classifyAgentIntent(params: {
  runId: string;
  question: string;
  contextText?: string;
  trace?: { recorder: AgentTraceRecorder; parentId: string | null };
}): Promise<ClassifiedAgentIntent> {
  const history = params.contextText?.trim()
    ? `\n\nKontext poslednich zprav:\n${params.contextText}`
    : "";

  const traceParams = params.trace
    ? { recorder: params.trace.recorder, parentId: params.trace.parentId, name: "llm.intent.classify" as const }
    : undefined;

  const ask = async () =>
    generateWithAzureProxy({
      runId: params.runId,
      maxTokens: 220,
      trace: traceParams,
      messages: [
        {
          role: "system",
          content:
            "Zarad pozadavek uzivatele do jedne kategorie. Vrat POUZE JSON bez markdownu nebo vysvetlovani, tvar:\n" +
            '{"intent":"analytics"|"calendar_email"|"weekly_report"|"web_search","slideCount":<cislo 2-15 nebo vynechej>}\n\n' +
            "analytics: interni data, SQL, KPI, klienti, leady, nemovitosti, dashboard.\n" +
            "calendar_email: e-mail, prohlidka, termin schuzky, kalendář, Gmail draft.\n" +
            "weekly_report: report pro vedeni, vystup pro manazerstvi, slidova prezentace, PPTX.\n" +
            "web_search: informace z internetu, aktualni udalosti, overeni faktu mimo interni databazi.\n" +
            "slideCount dopln jen u weekly_report pokud uzivatel zminil konkretni pocet slidu; jinak vynechej (system pouzije standard 3)."
        },
        { role: "user", content: `Pozadavek:\n${params.question}${history}` }
      ]
    });

  let llm = await ask();
  let parsed = tryParseJsonObject(IntentSchema, llm.text);
  if (parsed) {
    if (params.trace?.recorder && llm.traceEventId) {
      void params.trace.recorder.record({
        parentId: llm.traceEventId,
        kind: "orchestrator",
        name: "intent.parsed",
        output: { intent: parsed.intent, slideCount: parsed.slideCount }
      });
    }
    return parsed;
  }

  llm = await generateWithAzureProxy({
    runId: params.runId,
    maxTokens: 200,
    trace: params.trace
      ? { recorder: params.trace.recorder, parentId: params.trace.parentId, name: "llm.intent.repair" }
      : undefined,
    messages: [
      { role: "system", content: "Predchozi vystup nebyl validni JSON. Oprav ho na jediny JSON objekt dle IntentSchema, bez dalsiho textu." },
      { role: "user", content: llm.text }
    ]
  });
  parsed = tryParseJsonObject(IntentSchema, llm.text);
  if (parsed) {
    if (params.trace?.recorder && llm.traceEventId) {
      void params.trace.recorder.record({
        parentId: llm.traceEventId,
        kind: "orchestrator",
        name: "intent.parsed",
        output: { intent: parsed.intent, slideCount: parsed.slideCount }
      });
    }
    return parsed;
  }

  return { intent: "analytics" };
}
