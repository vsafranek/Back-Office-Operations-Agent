import { z } from "zod";
import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";
import {
  ProposeScheduledAgentTaskInputSchema,
  ProposeScheduledAgentTaskOutputSchema
} from "@/lib/agent/mcp-tools/config/tools/propose-scheduled-agent-task.tool";
import { StoredMarketListingsParamsSchema } from "@/lib/agent/tools/market-listings-tool";

const LlmExtractionSchema = z.object({
  title: z.string().min(1),
  cron_expression: z.string().min(1),
  timezone: z.string().optional(),
  system_prompt: z.string().min(1),
  user_question: z.string().optional(),
  agent_id: z.enum(["basic", "thinking-orchestrator"]).optional(),
  execution_intent: z
    .enum(["analytics", "calendar_email", "presentation", "weekly_report", "web_search", "market_listings"])
    .optional(),
  /** Volitelně: filtry pro Sreality/Bezrealitky (location, sources, srealityOfferKind, …). */
  market_listings_params: z.record(z.string(), z.unknown()).optional()
});

const EXTRACTION_SYSTEM = `Z pozadavku uzivatele vyextrahuj navrh OPAKOVANE naplanovane ulohy pro back-office agenta.
Orchestrator uz zaradil pozadavek jako scheduled_agent_task — ocekava se tedy opakovani nebo automaticky beh (cron). Pro ciste jednorazove „ukaž / informuj o nabidkach“ bez pravidelnosti orchestrator obvykle voli market_listings; tady dopln rozumny denni cron jen pokud uzivatel zadal frekvenci nebo slova jako denne, kazdy den, rano, pravidelne.

Vrat POUZE jeden JSON objekt (bez markdownu), klice:
- title, cron_expression (5 poli pg_cron), timezone (IANA, vychozi Europe/Prague), system_prompt, user_question, agent_id ("basic"|"thinking-orchestrator")
- execution_intent: jaky typ specialisty ma resit OBSAH jednoho behu ("analytics"|"calendar_email"|"presentation"|"weekly_report"|"web_search"|"market_listings")
- market_listings_params (volitelny objekt): pri sledovani nabidek Sreality/Bezrealitky nastav napr. location Plzen, sources [sreality,bezrealitky], srealityOfferKind prodej|pronajem, bezrealitkyOfferType PRODEJ|PRONAJEM, srealityCategoryMain 1=byty 2=domy, perPage, regionGeocodeHint.
Pokud uzivatel cas cronu nedefinuje ale z kontextu jde o denni monitoring, pouzij 0 9 * * * a timezone Europe/Prague.

system_prompt — POZOR:
- Popisuje POUZE roli a obsah JEDNOHO behu agenta (co ma vystupovat: styl, format, co zahrnout/vynechat, obor realitni back-office).
- Zde NEPIS o opakovani, case, cronu, pg_cron, „kazdy den“, „pravidelne spoustet“, „automaticky hlidat do budoucna“, „naplanuj dalsi ulohu“ ani o vytvareni dalsich cron jobu — to uz resi ulozeny cron a tento text se vklada do kazdeho behu znovu; agent by si jinak myslel, ze ma znovu zakladat planovani.
- Frekvenci a cas vyjadri VYHRADNE pres cron_expression + timezone, ne v system_prompt.

user_question: konkretni dotaz nebo sablona pro tento beh (co zrovna zpracovat); opet bez navodu na dalsi cron.
execution_intent urci podle obsahu behu: sledovani inzeratu => market_listings; SQL/KPI => analytics; e-mail/termin => calendar_email; atd.

Pri pravidelnem sledovani novych nabidek vzdy dopln market_listings_params s location a sources.`;

function buildIntentMarker(intent: z.infer<typeof LlmExtractionSchema>["execution_intent"]): string {
  if (!intent) return "";
  return `[[SCHEDULED_EXECUTION_INTENT:${intent}]]`;
}

export async function runScheduledTaskProposalSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  question: string;
  contextText: string;
}): Promise<AgentAnswer> {
  const llmTrace = params.ctx.trace
    ? { recorder: params.ctx.trace, parentId: params.ctx.traceParentId ?? null }
    : undefined;

  const userContent =
    `--- Aktualni pozadavek ---\n${params.question}\n\n--- Kontext konverzace ---\n` +
    (params.contextText.trim() || "(prazdny)");

  const ask = async (name: "llm.scheduled_task.extract" | "llm.scheduled_task.extract.repair") =>
    generateWithAzureProxy({
      runId: params.ctx.runId,
      maxTokens: name.endsWith("repair") ? 900 : 1200,
      trace: llmTrace ? { ...llmTrace, name } : undefined,
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM },
        { role: "user", content: userContent }
      ]
    });

  let llm = await ask("llm.scheduled_task.extract");
  let raw = tryParseJsonObject(LlmExtractionSchema, llm.text);
  if (!raw) {
    llm = await ask("llm.scheduled_task.extract.repair");
    raw = tryParseJsonObject(LlmExtractionSchema, llm.text);
  }

  if (!raw) {
    return {
      answer_text:
        "Nepodařilo se z vašeho zadání spolehlivě vyčíst návrh cron úlohy (JSON). Zkuste prosím napsat konkrétně: " +
        "název, čas opakování (např. každý den v 8:00), co má agent při každém běhu dělat a případně zda chcete profil „basic“ nebo „thinking“.",
      confidence: 0.25,
      sources: [],
      generated_artifacts: [],
      next_actions: ["Zkuste zadání zopakovat s jasnějším časem a popisem úlohy."]
    };
  }

  const mlpParsed =
    raw.market_listings_params != null
      ? StoredMarketListingsParamsSchema.safeParse(raw.market_listings_params)
      : null;
  const market_listings_params =
    mlpParsed?.success && mlpParsed.data && Object.keys(mlpParsed.data).length > 0 ? mlpParsed.data : undefined;

  const toolInput: z.infer<typeof ProposeScheduledAgentTaskInputSchema> = {
    title: raw.title.trim(),
    cron_expression: raw.cron_expression.trim(),
    timezone: (raw.timezone ?? "Europe/Prague").trim(),
    system_prompt: [buildIntentMarker(raw.execution_intent), raw.system_prompt.trim()].filter(Boolean).join("\n"),
    user_question: raw.user_question?.trim() || "Splň naplánovanou úlohu podle systémového zadání.",
    agent_id: raw.agent_id ?? "basic",
    ...(market_listings_params ? { market_listings_params } : {})
  };

  try {
    const out = await params.toolRunner.run<z.infer<typeof ProposeScheduledAgentTaskOutputSchema>>(
      "proposeScheduledAgentTask",
      params.ctx,
      toolInput
    );
    return {
      answer_text: out.message,
      confidence: 0.9,
      sources: ["proposeScheduledAgentTask"],
      generated_artifacts: [],
      next_actions: [
        "Potvrďte úlohu v sekci „Data a grafy“ pod touto odpovědí nebo v postranním panelu → Úlohy (cron); teprve pak se uloží do databáze."
      ],
      dataPanel: { kind: "scheduled_task_confirmation", draft: out.draft }
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Neznámá chyba";
    return {
      answer_text: `Návrh úlohy se nepodařilo ověřit: ${msg}. Upravte prosím cron výraz (5 polí jako v pg_cron) nebo časovou zónu.`,
      confidence: 0.35,
      sources: [],
      generated_artifacts: [],
      next_actions: ["Zkontrolujte platnost cron výrazu a zkuste znovu."]
    };
  }
}
