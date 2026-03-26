import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/system-prompt";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";

export async function runCalendarEmailSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  contextText: string;
}): Promise<AgentAnswer> {
  const slots = await params.toolRunner.run<{ start: string; end: string }[]>("suggestViewingSlots", params.ctx, {
    userId: params.ctx.userId,
    daysAhead: 7,
    limit: 3
  });

  const recommended = slots[0];

  const llm = await generateWithAzureProxy({
    runId: params.ctx.runId,
    messages: [
      { role: "system", content: AGENT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Napis kratky cesky email zajemci o nemovitost. Nabidni termin: ${recommended?.start ?? "dohodou"}.\n\nHistorie:\n${params.contextText}`
      }
    ]
  });

  const draft = await params.toolRunner.run<{ draftId?: string; messageId?: string }>("createEmailDraft", params.ctx, {
    userId: params.ctx.userId,
    to: "lead@example.com",
    subject: "Navrh terminu prohlidky nemovitosti",
    body: llm.text
  });

  return {
    answer_text: "Pripravil jsem navrh e-mailu a ulozil draft do Gmailu.",
    confidence: 0.84,
    sources: ["google_calendar", "gmail_draft"],
    generated_artifacts: [
      {
        type: "email",
        label: `Draft ${draft.draftId ?? "created"}`,
        content: llm.text
      }
    ],
    next_actions: ["Schval draft a odesli klientovi.", "Pripadne uprav navrzeny termin prohlidky."]
  };
}

