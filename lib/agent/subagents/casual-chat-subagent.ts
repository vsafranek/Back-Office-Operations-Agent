import { z } from "zod";
import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";

const ReplySchema = z.object({
  answer_text: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  next_actions: z.array(z.string()).optional()
});

/** Jednoduchá záloha, když klasifikátor omylem pošle dotaz do web_search. */
export function isLikelyCasualOnlyMessage(text: string): boolean {
  const q = text.trim();
  if (q.length === 0 || q.length > 120) return false;
  const lower = q.toLowerCase();
  const casual =
    /^(ahoj|ahojky|čau|čus|nazdar|zdar|hello|hi|hey|good\s*morning)\b|^dobrý\s*(den|ráno|večer)\b|^jak\s+se\s+má(š|s)\s*[?.!]?\s*$/i.test(
      q
    ) ||
    /^(díky|děkuji|thanks|thank\s+you|měj\s+se|mějte\s+se|nashledanou)\b/i.test(lower) ||
    /^co\s+ty\s*\??$/i.test(q) ||
    /^jak\s+se\s+daří/i.test(lower);
  return casual;
}

const CASUAL_SYSTEM = `Jsi asistent realitní back-office aplikace (klienti a leady v databázi, reporty, grafy, e-mail a kalendář, nabídky z portálů Sreality/Bezrealitky, naplánované úlohy).

Uživatel napsal zprávu bez konkrétního pracovního zadání: pozdrav, poděkování, small talk (např. „jak se máš“), obecná zdvořilost nebo krátká konverzace mimo úkoly.

Vrať POUZE jeden JSON objekt (bez markdownu), klíče:
- answer_text (řetězec, česky)
- confidence (0 až 1, volitelné; výchozí 0.92)
- next_actions (pole 2–4 krátkých konkrétních návrhů dalšího dotazu v češtině)

Pravidla pro answer_text:
- Stručně, přátelsky a profesionálně (cca 2–5 vět).
- Na „jak se máš“ nebo pozdrav odpověz přirozeně — můžeš říct, že jsi k dispozici a máš se dobře v roli asistenta; NEříkej, že „ze zdrojů nelze určit“, že nemáš data o svém stavu, ani nezmiňuj vyhledávače či chybějící excerpt stránek.
- Nevymýšlej fakta o firmě ani o uživateli.
- Na závěr jemně připomeň, s čím můžeš v back-office pomoci (příklady výše).

next_actions: konkrétní tipy, co může uživatel napsat jako další (např. „Ukaž nové leady za týden“).`;

export async function runCasualChatSubAgent(params: {
  ctx: AgentToolContext;
  question: string;
}): Promise<AgentAnswer> {
  const trace = params.ctx.trace
    ? {
        recorder: params.ctx.trace,
        parentId: params.ctx.traceParentId ?? null,
        name: "llm.subagent.casual-chat" as const
      }
    : undefined;

  const userBlock = `Zpráva uživatele:\n${params.question.trim()}`;

  let llm = await generateWithAzureProxy({
    runId: params.ctx.runId,
    maxTokens: 500,
    trace,
    messages: [
      { role: "system", content: CASUAL_SYSTEM },
      { role: "user", content: userBlock }
    ]
  });

  let parsed = tryParseJsonObject(ReplySchema, llm.text);
  if (!parsed) {
    llm = await generateWithAzureProxy({
      runId: params.ctx.runId,
      maxTokens: 400,
      trace: trace
        ? { ...trace, name: "llm.subagent.casual-chat.repair" as const }
        : undefined,
      messages: [
        { role: "system", content: "Předchozí výstup nebyl platný JSON. Vrať pouze jeden objekt {answer_text, confidence?, next_actions?}." },
        { role: "user", content: llm.text }
      ]
    });
    parsed = tryParseJsonObject(ReplySchema, llm.text);
  }

  if (!parsed) {
    return {
      answer_text:
        "Ahoj, mám se dobře — díky za optání. Jsem tu jako back-office asistent: můžu pomoct s daty z CRM, reporty, e-mailem a kalendářem, nabídkami z realitních portálů nebo naplánovanými úlohami. Napište, co potřebujete.",
      confidence: 0.88,
      sources: [],
      generated_artifacts: [],
      next_actions: ["Shrň nové leady za poslední týden.", "Navrhni e-mail na domluvení prohlídky.", "Stáhni nabídky z Sreality pro zadanou lokalitu."]
    };
  }

  return {
    answer_text: parsed.answer_text,
    confidence: parsed.confidence ?? 0.92,
    sources: [],
    generated_artifacts: [],
    next_actions: parsed.next_actions?.length
      ? parsed.next_actions
      : ["Zeptejte se na klienty nebo leady v databázi.", "Požádejte o týdenní report nebo prezentaci."]
  };
}
