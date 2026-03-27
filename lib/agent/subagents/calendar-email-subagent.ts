import { z } from "zod";
import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/system-prompt";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";

const DraftJsonSchema = z.object({
  subject: z.string(),
  body: z.string()
});

export async function runCalendarEmailSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  question: string;
  contextText: string;
}): Promise<AgentAnswer> {
  const slots = await params.toolRunner.run<{ start: string; end: string }[]>("suggestViewingSlots", params.ctx, {
    userId: params.ctx.userId,
    daysAhead: 7,
    limit: 3
  });

  const recommended = slots[0];

  const draftInstructions =
    `${AGENT_SYSTEM_PROMPT}\n\n` +
    "Navrhni kratky cesky e-mail zajemci o nemovitost. Vrat POUZE validni JSON bez markdownu " +
    've tvaru {"subject":"...","body":"..."}. Predmet i telo v cestine.';

  const userPrompt =
    `Pozadavek uzivatele: ${params.question}\n\n` +
    `Preferovany termin prohlidky (nabidni ho v tele): ${recommended?.start ?? "dohodou"}\n\n` +
    `Historie konverzace:\n${params.contextText}`;

  const llmTrace = params.ctx.trace
    ? { recorder: params.ctx.trace, parentId: params.ctx.traceParentId ?? null }
    : undefined;

  let llm = await generateWithAzureProxy({
    runId: params.ctx.runId,
    maxTokens: 900,
    trace: llmTrace ? { ...llmTrace, name: "llm.calendar-email.draft" } : undefined,
    messages: [
      { role: "system", content: draftInstructions },
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
        { role: "system", content: draftInstructions },
        {
          role: "user",
          content: `${userPrompt}\n\nPredchozi vystup nebyl pouzitelny JSON. Oprav na jediny objekt {subject, body}.\n${llm.text}`
        }
      ]
    });
    parsed = tryParseJsonObject(DraftJsonSchema, llm.text);
  }

  const subject = parsed?.subject.trim() || params.question.trim().slice(0, 78) || "E-mail";
  const body = parsed?.body.trim() || llm.text.trim();

  const draft = await params.toolRunner.run<{ draftId?: string; messageId?: string }>("createEmailDraft", params.ctx, {
    userId: params.ctx.userId,
    to: "lead@example.com",
    subject,
    body
  });

  const reply = await generateUserFacingReply({
    runId: params.ctx.runId,
    maxTokens: 650,
    trace: llmTrace
      ? { ...llmTrace, name: "llm.calendar-email.assistant-summary" }
      : undefined,
    userContent: [
      `Co chtel uzivatel: ${params.question}`,
      `Navrhnute sloty (JSON): ${JSON.stringify(slots)}`,
      `Predmet draftu: ${subject}`,
      `Telo draftu:\n${body}`,
      `Technicky: draftId ${draft.draftId ?? "n/a"}`,
      "Strucne rekni uzivateli v cestine, co bylo pripraveno, a navrhni 2–4 dalsi kroky. Nevymyslej fakta mimo draft a sloty."
    ].join("\n\n")
  });

  const artifactContent = JSON.stringify({ subject, body }, null, 2);

  return {
    answer_text: reply.answer_text,
    confidence: reply.confidence,
    sources: ["google_calendar", "gmail_draft"],
    generated_artifacts: [
      {
        type: "email",
        label: `Draft ${draft.draftId ?? "created"}`,
        content: artifactContent
      }
    ],
    next_actions: reply.next_actions
  };
}
