import { z } from "zod";
import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";
import { INTENT_CLASSIFIER_IDENTITY } from "@/lib/agent/system-prompt";

const IntentSchema = z.object({
  intent: z.enum([
    "analytics",
    "calendar_email",
    "presentation",
    "weekly_report",
    "web_search",
    "market_listings",
    "scheduled_agent_task",
    "casual_chat"
  ]),
  slideCount: z.number().int().min(1).max(14).optional()
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
            `${INTENT_CLASSIFIER_IDENTITY}\n\n` +
            "Zarad pozadavek uzivatele do jedne kategorie. Vrat POUZE JSON bez markdownu nebo vysvetlovani, tvar:\n" +
            '{"intent":"analytics"|"calendar_email"|"presentation"|"weekly_report"|"web_search"|"market_listings"|"scheduled_agent_task"|"casual_chat","slideCount":<cislo 1-14 poctu obsahovych slidu bez titulku nebo vynechej>}\n\n' +
            "Nejdrive zvaz: jde o pozdrav, podekovani, „jak se mas“, small talk nebo zdvorilost BEZ pracovniho ukolu? → casual_chat. V tom pripade NIKDY web_search.\n" +
            "analytics: interni data, SQL, KPI, klienti, leady, dashboard — tabulka, CSV, graf nebo Markdown z dat. „Znazornit“ v kontextu cisel/dashboardu/reportu z DB je analytics; PPTX jen kdyz je zrejmy slidovy deck (viz presentation).\n" +
            "calendar_email: e-mail, prohlidka, termin schuzky, kalendář, Gmail draft — text pak zušlechťuje specialista na oficiální maily. " +
            "Pokud kontext poslednich zprav ukazuje, ze asistent prave nabidl navrh e-mailu k prohlidce / kandidaty na prijemce a uzivatel nyni jen doplňuje prijemce (holý e-mail, „prvni“, „druhy“, jmeno z nabidky) nebo zopakuje stejny ukol s doplnenym emailem → stale calendar_email (NE casual_chat).\n" +
            "presentation: hlavne PPTX/slidova prezentace / slidovy deck (PowerPoint); NE jen graf nad daty v aplikaci — to je analytics.\n" +
            "weekly_report: komplexni report pro vedeni — dataset CSV, souhrn MD a prezentace dohromady.\n" +
            "market_listings: nabidky z realitnich portálu (Sreality, Bezrealitky), stazeni inzeratu pres interni nastroj fetchMarketListings, monitoring trhu. I kdyz uzivatel napise 'internet'. NENI to obecne DDG/Google ani SQL nad CRM.\n" +
            "web_search: jen kdyz uzivatel EXPLICITNE chce overit fakt, aktualitu nebo informaci na verejnem webu (mimo interni DB). NIKOLIV u pozdravu ani vyznamu bezne fraze. NIKOLIV „jak se mas“.\n" +
            "scheduled_agent_task: uzivatel chce nastavit OPAKOVANOU ulohu (cron), automaticky beh agenta, systemovy prompt, cas — napr. kazdy den v 8, kazdou hodinu, pg_cron. NENI to jednorazovy analyticky dotaz.\n" +
            "casual_chat: pozdravy, diky, „jak se mas“, obecna zdvorilost, konverzace bez pozadavku na data, nastroje, e-mail, report ani webovy fakticky dotaz.\n" +
            "slideCount dopln u presentation nebo weekly_report pri konkretnim poctu OBSAHOVYCH slidu bez titulku (cislice nebo cesky); jinak vynechej (system pouzije standard 3 obsahove + titulek)."
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
