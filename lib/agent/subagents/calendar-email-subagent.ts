import { z } from "zod";
import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";
import { extractEmailFromText, inferViewingSlotParams } from "@/lib/agent/calendar-email-slots-params";
import {
  buildViewingSlotsFromCalendarAvailability,
  type CalendarAvailabilityResult,
  type ViewingSlotsResult
} from "@/lib/agent/tools/calendar-tool";
import { getSenderProfileForCalendarEmail } from "@/lib/agent/tools/calendar-email-sender-profile";

const DraftJsonSchema = z.object({
  to: z.string().optional(),
  subject: z.string(),
  body: z.string()
});

/**
 * Orchestrátor směruje záměr a předává jádro zprávy v uživatelském promptu;
 * tento systém definuje roli „expert na oficiální e-maily“, který jen formu zušlechťuje.
 */
const CALENDAR_EMAIL_EXPERT_SYSTEM = `Jsi seniorní specialista na obchodní e-mail v češtině — realitní makléřská korespondence (zájemci, prohlídky, domlouvání termínů).

Vnitřní orchestrátor ti v uživatelské zprávě předá odděleně:
1) **Jádro e-mailu** — co má být řečeno, v jakém duchu, případně hrubé body nebo styl zadání od uživatele (včetně kontextu konverzace). To ber jako zadání od orchestrátora: **nezpochybňuj záměr**, nevynechávej podstatné informace, které tam jsou.
2) **Pevná fakta** — kalendář (obsazenost z nástroje browseCalendarAvailability + navržené termíny odvozené z těchto dat), jméno podpisu atd. Ta do těla zapracuj přesně (časy, datumy, formulace termínů).

Tvůj úkol je **jen zušlechtit formu**: oficiální, profesionální tón, vykání adresáta, srozumitelná struktura (např. pozdrav, důvod kontaktu, nabídka termínů / další krok, závěr), spisovná čeština. Vyhni se hovorovinám a stylu chatu. **Neměň věcný obsah** — nesnižuj závazky, nevyvracej domluvy, nepřidávej fakta, která v zadání nejsou.

Výstup je vždy POUZE jeden validní JSON objekt (bez markdownu, bez komentářů) ve tvaru:
{"subject":"...","body":"...","to":"..."}
- subject: stručný, věcný předmět v češtině.
- body: celý text e-mailu v češtině; pokud jádro neobsahuje oslovení, začni vhodně (např. „Dobrý den,“).
- to: e-mail příjemce jen pokud je znám z jádra, kontextu nebo pevných faktů; jinak prázdný řetězec "".

Na konec těla e-mailu vždy doplň zdvořilý podpis: řádek „S pozdravem,“ a na další řádek **přesně** řetězec JMÉNO ODESÍLATELE tak, jak ho dostaneš v uživatelské zprávě (bez úprav, bez titulů, které tam nejsou). Do těla nepiš interní poznámky (orchestrátor, agent, JSON).

E-mail je pouze návrh k uložení jako draft — neříkej, že byl odeslán.`;

export async function runCalendarEmailSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  question: string;
  contextText: string;
}): Promise<AgentAnswer> {
  const { daysAhead, limit } = inferViewingSlotParams(params.question);

  const calendarView = await params.toolRunner.run<CalendarAvailabilityResult>(
    "browseCalendarAvailability",
    params.ctx,
    {
      userId: params.ctx.userId,
      daysAhead
    }
  );

  const slots = buildViewingSlotsFromCalendarAvailability(calendarView, { limit });
  const slotBundle: ViewingSlotsResult = { ...calendarView, slots };
  const recommended = slots[0];

  const sender = await getSenderProfileForCalendarEmail(params.ctx.userId);

  const userPrompt =
    `--- Jádro e-mailu a kontext od orchestrátora (uprav pouze styl a formu, zachovej záměr a fakta z textu) ---\n` +
    `Aktuální požadavek uživatele:\n${params.question}\n\n` +
    `Kontext konverzace (může obsahovat shrnutí, úvahu nebo dřívější zprávy — ber to jako součást zadání orchestrátora):\n` +
    `${params.contextText.trim() || "(žádný další kontext)"}\n\n` +
    `--- Pevná fakta k zapracování do těla e-mailu ---\n` +
    `JMÉNO ODESÍLATELE (podpis pod e-mailem, přesně tento řetězec): ${sender.displayName}\n` +
    (sender.email ? `E-mail odesílatele (jen kontext, nevkládej jako hlavní obsah zprávy): ${sender.email}\n` : "") +
    `Obsazenost kalendáře z nástroje browseCalendarAvailability (busy intervaly, ISO):\n${JSON.stringify(calendarView.busy)}\n` +
    `Doporučený první volný termín prohlídky (ISO): ${recommended?.start ?? "neurčeno"} – ${recommended?.end ?? ""}\n` +
    `Všechny navržené sloty odvozené z obsazenosti (JSON, použij je v profesionální formulaci v těle):\n${JSON.stringify(slots)}`;

  const llmTrace = params.ctx.trace
    ? { recorder: params.ctx.trace, parentId: params.ctx.traceParentId ?? null }
    : undefined;

  let llm = await generateWithAzureProxy({
    runId: params.ctx.runId,
    maxTokens: 900,
    trace: llmTrace ? { ...llmTrace, name: "llm.calendar-email.draft" } : undefined,
    messages: [
      { role: "system", content: CALENDAR_EMAIL_EXPERT_SYSTEM },
      { role: "user", content: userPrompt }
    ]
  });

  let parsed = tryParseJsonObject(DraftJsonSchema, llm.text);
  if (!parsed) {
    llm = await generateWithAzureProxy({
      runId: params.ctx.runId,
      maxTokens: 900,
      trace: llmTrace ? { ...llmTrace, name: "llm.calendar-email.draft.repair" } : undefined,
      messages: [
        { role: "system", content: CALENDAR_EMAIL_EXPERT_SYSTEM },
        {
          role: "user",
          content: `${userPrompt}\n\nPředchozí výstup nebyl použitelný JSON. Oprav na jediný objekt {subject, body, to?}.\n${llm.text}`
        }
      ]
    });
    parsed = tryParseJsonObject(DraftJsonSchema, llm.text);
  }

  let to = (parsed?.to ?? "").trim();
  if (!to) {
    to = extractEmailFromText(params.question) ?? extractEmailFromText(params.contextText) ?? "";
  }

  const subject = parsed?.subject.trim() || params.question.trim().slice(0, 78) || "E-mail";
  let body = parsed?.body.trim() || llm.text.trim();
  const signOff = `\n\nS pozdravem,\n${sender.displayName}`;
  if (!body.trimEnd().endsWith(sender.displayName)) {
    body = `${body.trimEnd()}${signOff}`;
  }

  const reply = await generateUserFacingReply({
    runId: params.ctx.runId,
    maxTokens: 650,
    trace: llmTrace
      ? { ...llmTrace, name: "llm.calendar-email.assistant-summary" }
      : undefined,
    userContent: [
      `Zadání uživatele (orchestrátor ho směroval k expertovi na maily): ${params.question}`,
      `Specialista na maily upravil znění do oficiální podoby; návrh slotů: ${JSON.stringify(slots)}`,
      `Navrhovaný příjemce (může být prázdný): ${to || "(doplní uživatel v panelu)"}`,
      `Předmět: ${subject}`,
      `Tělo e-mailu:\n${body}`,
      "Stručně česky uveď, že v pravém panelu má uživatel oficiálně formulovaný návrh e-mailu a kalendářové termíny, může zvolit uložení draftu v Gmailu nebo odeslat rovnou (po potvrzení), a může propojit leady (UUID) s auditním záznamem. " +
        "Draft v Gmailu ještě nevznikl. Navrhni 2–4 další kroky."
    ].join("\n\n")
  });

  return {
    answer_text: reply.answer_text,
    confidence: reply.confidence,
    sources: ["browseCalendarAvailability", "google_calendar", "gmail_draft_pending"],
    generated_artifacts: [
      {
        type: "email",
        label: "Návrh e-mailu (upravte v pravém panelu)",
        content: JSON.stringify({ to: to || null, subject, body: body.slice(0, 2000) + (body.length > 2000 ? "…" : "") }, null, 2)
      }
    ],
    next_actions: reply.next_actions,
    dataPanel: {
      kind: "viewing_email_draft",
      slots,
      calendarPreview: {
        busy: slotBundle.busy,
        rangeStart: slotBundle.rangeStart,
        rangeEnd: slotBundle.rangeEnd
      },
      senderDisplayName: sender.displayName,
      draft: { to, subject, body },
      conversationId: params.ctx.conversationId ?? null,
      agentRunId: params.ctx.runId
    }
  };
}
