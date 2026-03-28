import { z } from "zod";
import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";
import {
  ProposeScheduledAgentTaskInputSchema,
  ProposeScheduledAgentTaskOutputSchema
} from "@/lib/agent/mcp-tools/config/tools/propose-scheduled-agent-task.tool";

const LlmExtractionSchema = z.object({
  title: z.string().min(1),
  cron_expression: z.string().min(1),
  timezone: z.string().optional(),
  system_prompt: z.string().min(1),
  user_question: z.string().optional(),
  agent_id: z.enum(["basic", "thinking-orchestrator"]).optional()
});

const EXTRACTION_SYSTEM = `Z pozadavku uzivatele vyextrahuj navrh OPAKOVANE naplanovane ulohy pro back-office agenta.
Vrat POUZE jeden JSON objekt (bez markdownu):
{
  "title": "kratky nazev ulohy",
  "cron_expression": "5 poli jako v PostgreSQL pg_cron: minuta hodina den_mesice mesic den_tydne, napr. 0 8 * * * pro kazdy den 8:00",
  "timezone": "IANA casova zona, vychozi Europe/Prague pokud nejasne",
  "system_prompt": "podrobne systemove instrukce pro agenta pri kazdem automaticke behu (role, format, omezeni)",
  "user_question": "kratke opakovane zadani pri kazdem behu (napr. co konkretne udelat tentokrat)",
  "agent_id": "basic" nebo "thinking-orchestrator" podle slozitosti; vychozi basic
}
Pokud uzivatel cas nedefinuje rozumne, pouzij 0 9 * * * a timezone Europe/Prague.
system_prompt a user_question musi davat smysl v kontextu realitni back-office firmy.`;

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

  const toolInput: z.infer<typeof ProposeScheduledAgentTaskInputSchema> = {
    title: raw.title.trim(),
    cron_expression: raw.cron_expression.trim(),
    timezone: (raw.timezone ?? "Europe/Prague").trim(),
    system_prompt: raw.system_prompt.trim(),
    user_question: raw.user_question?.trim() || "Splň naplánovanou úlohu podle systémového zadání.",
    agent_id: raw.agent_id ?? "basic"
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
      next_actions: ["Potvrďte úlohu v pravém panelu — teprve pak se uloží do databáze."],
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
