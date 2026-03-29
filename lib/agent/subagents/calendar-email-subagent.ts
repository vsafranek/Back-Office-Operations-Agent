import { z } from "zod";
import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";
import {
  buildCalendarEmailRecipientSearchHay,
  relatedLeadIdsFromRecipient,
  resolveRecipientFromFollowUp,
  searchEmailRecipientCandidates,
  toViewingRecipientCandidates,
  type EmailRecipientCandidate
} from "@/lib/agent/calendar-email-recipient-search";
import { extractRecipientCrmSearchTerms } from "@/lib/agent/calendar-email-recipient-hints";
import { extractEmailFromText, inferViewingSlotParams } from "@/lib/agent/calendar-email-slots-params";
import {
  buildViewingSlotsFromCalendarAvailability,
  type CalendarAvailabilityResult,
  type ViewingSlotsResult
} from "@/lib/agent/tools/calendar-tool";
import {
  crmContextNeedsPropertyDisambiguation,
  fetchCalendarEmailCrmContext,
  fetchPropertySummaryFromLeadIds,
  resolveClientIdForCalendarEmail
} from "@/lib/agent/calendar-email-property-context";
import { getSenderProfileForCalendarEmail } from "@/lib/agent/tools/calendar-email-sender-profile";
import {
  applyViewingConfirmedSlotToBody,
  formatViewingSlotRange
} from "@/lib/agent/viewing-email-slot-body";
import { ensureViewingEmailSignOff, stripViewingEmailSignOff } from "@/lib/agent/viewing-email-sign-off";

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
2) **Pevné údaje** — obsazenost kalendáře, interní návrh jednoho termínu (ISO + délka v minutách), případně **strukturovaný export z CRM** (klient, leady, nemovitosti), jméno odesílatele pro podpis. **ISO časy do těla e-mailu nepřepisuj** a **nepřeváděj je na lidskou formulaci** (den, datum, hodiny „od–do“) — vznikají jiné časy než přesný řádek, který k e-mailu doplní aplikace.

   **CRM:** Máš k dispozici fakta o klientovi a o nemovitostech, o které měl zájem. **Zamysli se**, co z toho příjemci v e-mailu pomůže (připomenout správnou nabídku, lokalitu, typ bytu) — a co je interní nebo zbytečné (interní ref, dlouhé technické poznámky). Nekopíruj celý JSON do e-mailu; vyber smysluplnou podstatu v pár větách podle kontextu zprávy od makléře.

Tvůj úkol je **jen zušlechťovat formu**: oficiální tón, vykání, struktura (pozdrav, kontext zájemce a **nemovitosti** pokud je uvedena, obecná domluva prohlídky), závěr. K **času prohlídky** v odstavcích piš jen obecně (např. že zasíláte návrh termínu a prosíte o potvrzení, že Vám vyhovuje **termín uvedený níže v e-mailu**). **Neuváděj** konkrétní den v týdnu, datum ani hodiny. **Nepiš** odstavce typu „Navrhuji v pondělí 30. 3. od 7:00…“ ani délku schůzky po minutách. Spisovná čeština; žádné hovoroviny. **Neměň věcný obsah** zadání.

**Důležité:** Nevkládej řádek „Termín prohlídky:“ ani jiný pevný řádek s časem — ten za tebe přidá systém podle výběru v aplikaci. Žádný seznam alternativních časů.

Výstup je vždy POUZE jeden validní JSON objekt (bez markdownu, bez komentářů) ve tvaru:
{"subject":"...","body":"...","to":"..."}
- subject: stručný, věcný předmět v češtině.
- body: celý text e-mailu v češtině; pokud jádro neobsahuje oslovení, začni vhodně (např. „Dobrý den,“).
- to: e-mail příjemce **vždy** zapiš do pole "to", pokud je v sekci „Pevné údaje“ uveden řádek „E-mail příjemce“ nebo jednoznačná adresa v jádru/kontextu; přesně týž řetězec. Pokud opravdu není žádný známý příjemce, použij "".

Na konec těla e-mailu vždy doplň zdvořilý podpis: řádek „S pozdravem,“ a na další řádek **přesně** řetězec JMÉNO ODESÍLATELE tak, jak ho dostaneš v uživatelské zprávě (bez úprav, bez titulů, které tam nejsou). Do těla nepiš interní poznámky (orchestrátor, agent, JSON).

E-mail je pouze návrh k uložení jako draft — neříkej, že byl odeslán.`;

export async function runCalendarEmailSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  question: string;
  contextText: string;
  onAnswerDelta?: (chunk: string) => void | Promise<void>;
}): Promise<AgentAnswer> {
  const { daysAhead, limit: slotLimit, slotDurationMinutes } = inferViewingSlotParams(params.question);

  const calendarView = await params.toolRunner.run<CalendarAvailabilityResult>(
    "browseCalendarAvailability",
    params.ctx,
    {
      userId: params.ctx.userId,
      daysAhead
    }
  );

  const slots = buildViewingSlotsFromCalendarAvailability(calendarView, {
    limit: slotLimit,
    slotDurationMinutes
  });
  const slotBundle: ViewingSlotsResult = { ...calendarView, slots };
  const recommended = slots[0];

  const sender = await getSenderProfileForCalendarEmail(params.ctx.userId);

  const llmTrace = params.ctx.trace
    ? { recorder: params.ctx.trace, parentId: params.ctx.traceParentId ?? null }
    : undefined;

  let to =
    extractEmailFromText(params.question) ?? extractEmailFromText(params.contextText) ?? "";
  to = to.trim();

  const searchHay = buildCalendarEmailRecipientSearchHay(params.question, params.contextText);
  const crmHints = await extractRecipientCrmSearchTerms({
    text: searchHay,
    runId: params.ctx.runId,
    trace: llmTrace
  });

  const recipientCandidates = await searchEmailRecipientCandidates(searchHay, 8, {
    agentSearchTerms: crmHints.searchTerms.length > 0 ? crmHints.searchTerms : undefined
  });

  const resolved = resolveRecipientFromFollowUp(params.question, recipientCandidates);
  if (resolved) {
    to = resolved.email.trim();
  } else if (!to && recipientCandidates.length === 1) {
    to = recipientCandidates[0]!.email.trim();
  }
  if (!to) {
    to =
      extractEmailFromText(params.question)?.trim() ??
      extractEmailFromText(params.contextText)?.trim() ??
      "";
  }

  const chosenForLead =
    resolved ?? (recipientCandidates.length === 1 ? recipientCandidates[0] ?? null : null);
  let relatedLeadIds = relatedLeadIdsFromRecipient(to, chosenForLead, recipientCandidates);

  const singleCandidate: EmailRecipientCandidate | null =
    recipientCandidates.length === 1 ? recipientCandidates[0]! : null;
  const clientId = await resolveClientIdForCalendarEmail(
    chosenForLead,
    relatedLeadIds,
    singleCandidate
  );
  const crmContext = clientId ? await fetchCalendarEmailCrmContext(clientId) : null;

  const leadIdsForProperty =
    relatedLeadIds.length > 0
      ? relatedLeadIds
      : recipientCandidates.filter((c) => c.kind === "lead").map((c) => c.id);

  const propertySummaryLegacy = (await fetchPropertySummaryFromLeadIds(leadIdsForProperty)) ?? null;
  const propertySummary = crmContext?.compactPropertySummary ?? propertySummaryLegacy;

  const crmBlock =
    crmContext != null
      ? `ÚDAJE Z CRM (klient + zájem o nemovitosti — JSON). Nepiš strukturu JSON do e-mailu; vyber pro příjemce vhodné informace podle kontextu výše.\n${crmContext.crmPayloadForLlm}\n`
      : propertySummary != null
        ? `NEMOVITOST (z CRM — zkráceně, doporučení co zmínit v těle):\n${propertySummary}\n`
        : "";

  const singleSlotLine =
    recommended != null
      ? `INTERNÍ NÁVRH TERMÍNU (pro synchronizaci aplikace — do pole „body“ v JSON NEPIŠ, NEcituj a nepřeváděj na běžný text):\nDélka schůzky: ${slotDurationMinutes} min.\nZačátek ISO: ${recommended.start}\nKonec ISO: ${recommended.end}\n`
      : "TERMÍN: zatím nebyl nalezen volný slot — v těle nabídněte obecně domluvu termínu (bez konkrétní hodiny v odstavci).\n";

  const userPrompt =
    `--- Jádro e-mailu a kontext od orchestrátora (uprav pouze styl a formu, zachovej záměr a fakta z textu) ---\n` +
    `Aktuální požadavek uživatele:\n${params.question}\n\n` +
    `Kontext konverzace (může obsahovat shrnutí, úvahu nebo dřívější zprávy — ber to jako součást zadání orchestrátora):\n` +
    `${params.contextText.trim() || "(žádný další kontext)"}\n\n` +
    `--- Pevné údaje pro JSON a tělo ---\n` +
    (to ? `E-mail příjemce (zapiš stejný do pole "to" v JSON, pokud sedí): ${to}\n` : "") +
    `JMÉNO ODESÍLATELE (podpis, přesně tento řetězec): ${sender.displayName}\n` +
    (sender.email ? `E-mail odesílatele (jen kontext): ${sender.email}\n` : "") +
    crmBlock +
    `Obsazenost kalendáře (busy intervaly, ISO):\n${JSON.stringify(calendarView.busy)}\n` +
    singleSlotLine +
    `Interní poznámka: Makléř může v aplikaci změnit termín v kalendáři; v těle e-mailu znovu čas neuváděj.\n`;

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

  let toOut = to;
  const llmTo = (parsed?.to ?? "").trim();
  if (resolved) {
    toOut = resolved.email.trim();
  } else if (toOut) {
    toOut = toOut.trim();
  } else if (llmTo) {
    toOut = llmTo;
  }
  if (!toOut) {
    toOut =
      extractEmailFromText(params.question)?.trim() ??
      extractEmailFromText(params.contextText)?.trim() ??
      "";
  }
  if (!toOut && recipientCandidates.length === 1) {
    const only = recipientCandidates[0]!.email?.trim() ?? "";
    if (only) toOut = only;
  }

  relatedLeadIds = relatedLeadIdsFromRecipient(
    toOut,
    resolved ?? (recipientCandidates.length === 1 ? recipientCandidates[0] ?? null : null),
    recipientCandidates
  );

  const subject = parsed?.subject.trim() || params.question.trim().slice(0, 78) || "E-mail";
  let body = (parsed?.body ?? "").trim() || llm.text.trim();
  body = stripViewingEmailSignOff(body, sender.displayName);
  if (recommended) {
    body = applyViewingConfirmedSlotToBody(body, recommended, formatViewingSlotRange);
  } else {
    body = applyViewingConfirmedSlotToBody(body, null, formatViewingSlotRange);
  }
  body = ensureViewingEmailSignOff(body, sender.displayName);

  const candidatesLine =
    recipientCandidates.length > 0
      ? `Kandidáti na příjemce z CRM (JSON, pořadí 1..N odpovídá nabídce — uživatel může v chatu napsat „první“, „druhý“ nebo vložit e-mail): ${JSON.stringify(
          recipientCandidates.map((c, i) => ({
            poradi: i + 1,
            typ: c.kind,
            jmeno: c.fullName,
            email: c.email
          }))
        )}`
      : "Kandidáti z CRM: žádní (nebo nebylo čím hledat).";

  const needsPropertyOrLeadClarification = !toOut && recipientCandidates.length === 0;
  const ambiguousPropertyContext =
    crmContextNeedsPropertyDisambiguation(crmContext) ||
    (!crmContext && propertySummary != null && /;\s*2\)\s/.test(propertySummary));

  const reply = await generateUserFacingReply({
    runId: params.ctx.runId,
    maxTokens: 650,
    trace: llmTrace
      ? { ...llmTrace, name: "llm.calendar-email.assistant-summary" }
      : undefined,
    onAnswerDelta: params.onAnswerDelta,
    userContent: [
      `Zadání uživatele (calendar_email): ${params.question}`,
      `Návrh e-mailu je v postranním panelu → záložka Maily (komu, předmět, celé tělo). Do answer_text NEkopíruj podstatný text e-mailu ani „Termín prohlídky:“ — jen odkaz na panel.`,
      `Předmět návrhu (pro kontext, ne jako citace): ${subject}`,
      recommended
        ? "V kalendáři pod odpovědí je předvybraný první volný návrh termínu; makléř může klikem zvolit jiný slot nebo délku schůzky."
        : "V kalendáři zatím není konkrétní návrh termínu — popiš obecně další kroky.",
      `Počet vypočítaných slotů v nástroji: ${slots.length}.`,
      propertySummary ? `Nemovitosti / kontext z CRM (pro tvé shrnutí, nekopíruj doslova e-mail):\n${propertySummary}` : "",
      candidatesLine,
      `Navrhovaný příjemce (v editoru Maily): ${toOut || "(doplní uživatel)"}`,
      "answer_text: stručně česky — zmínit záložku Maily a náhled kalendáře ve vláknu; jak pokračovat (draft Gmail/Outlook, úpravy). Tabulka/graf u tohoto úkolu ne. Draft v poště ještě nevznikl. next_actions: 2–4 konkrétní kroky.",
      "Pokud jsou kandidáti na příjemce, v answer_text je vyjmenuj číslovaně (jméno + e-mail) a uveď, že stačí odpovědět „první“, „druhý“ nebo vložit e-mail.",
      ambiguousPropertyContext
        ? "V CRM připadá víc nemovitostí / kontextů — v answer_text uveď, že je potřeba dospecifikovat, o kterou nemovitost nebo zájemce přesně jde, aby odpovídal správný návrh."
        : !needsPropertyOrLeadClarification && propertySummary
          ? "V answer_text krátce ujasni, o jakou nemovitost v kontextu jde (jen podle CRM výše), aby byla konverzace srozumitelná."
          : "",
      needsPropertyOrLeadClarification
        ? "Příjemce není znám a z CRM nepřišli žádní kandidáti. V answer_text výslovně požádej uživatele, o jakou nemovitost nebo o kterého leada (jméno, kontakt) jde — nevymýšlej konkrétní jména ani adresy."
        : ""
    ]
      .filter(Boolean)
      .join("\n\n")
  });

  return {
    answer_text: reply.answer_text,
    confidence: reply.confidence,
    sources: ["browseCalendarAvailability", "google_calendar", "gmail_draft_pending"],
    generated_artifacts: [
      {
        type: "email",
        label: "Návrh e-mailu (záložka Maily)",
        content: JSON.stringify(
          { to: toOut || null, subject, body: body.slice(0, 2000) + (body.length > 2000 ? "…" : "") },
          null,
          2
        )
      }
    ],
    next_actions: reply.next_actions,
    dataPanel: {
      kind: "viewing_email_draft",
      meetingDurationMinutes: slotDurationMinutes,
      slots,
      ...(propertySummary ? { propertySummary } : {}),
      calendarPreview: {
        busy: slotBundle.busy,
        rangeStart: slotBundle.rangeStart,
        rangeEnd: slotBundle.rangeEnd
      },
      senderDisplayName: sender.displayName,
      draft: { to: toOut, subject, body },
      relatedLeadIds: relatedLeadIds.length > 0 ? relatedLeadIds : undefined,
      recipientCandidates:
        recipientCandidates.length > 0 ? toViewingRecipientCandidates(recipientCandidates) : undefined,
      conversationId: params.ctx.conversationId ?? null,
      agentRunId: params.ctx.runId
    }
  };
}
