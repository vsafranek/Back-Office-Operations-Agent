import { z } from "zod";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";
import { validateCronExpression } from "@/lib/scheduled-tasks/cron-helpers";
import { StoredMarketListingsParamsSchema } from "@/lib/agent/tools/market-listings-tool";

export const ProposeScheduledAgentTaskInputSchema = z.object({
  title: z.string().min(1).max(200),
  /** 5 polí jako pg_cron: minuta hodina den_měsíce měsíc den_týdne (např. `0 8 * * *`). */
  cron_expression: z.string().min(1).max(120),
  timezone: z.string().min(1).max(80).default("Europe/Prague"),
  system_prompt: z
    .string()
    .min(1)
    .max(12000)
    .describe(
      "Rola a obsah JEDNOHO behu agenta (format odpovedi, co hlidat). BEZ cronu, bez opakovani v case, bez navrhu dalsich naplanovanych uloh — frekvenci urcuje jen cron_expression."
    ),
  user_question: z.string().min(1).max(4000).default("Splň naplánovanou úlohu podle systémového zadání."),
  agent_id: z.enum(["basic", "thinking-orchestrator"]).default("basic"),
  market_listings_params: StoredMarketListingsParamsSchema.nullable().optional()
});

export const ProposeScheduledAgentTaskOutputSchema = z.object({
  message: z.string(),
  draft: z.object({
    title: z.string(),
    cron_expression: z.string(),
    timezone: z.string(),
    system_prompt: z.string(),
    user_question: z.string(),
    agent_id: z.string(),
    market_listings_params: z.record(z.string(), z.unknown()).nullable().optional()
  })
});

const tool: McpTool<z.infer<typeof ProposeScheduledAgentTaskInputSchema>, z.infer<typeof ProposeScheduledAgentTaskOutputSchema>> =
  {
    contract: {
      role: "tool",
      name: "proposeScheduledAgentTask",
      description:
        "Navrhne uložení opakované naplánované úlohy agenta (cron + systémový prompt). Po volání uživatel potvrdí v UI: sekce „Data a grafy“ u odpovědi a/nebo postranní panel → Úlohy (cron). Nástroj NEukládá do databáze.",
      inputSchema: ProposeScheduledAgentTaskInputSchema,
      outputSchema: ProposeScheduledAgentTaskOutputSchema,
      auth: "user",
      sideEffects: []
    },
    run: async (_ctx: AgentToolContext, input) => {
      const cronCheck = validateCronExpression(input.cron_expression, input.timezone);
      if (!cronCheck.ok) {
        throw new Error(`Neplatný cron: ${cronCheck.error}`);
      }
      const draft = {
        title: input.title.trim(),
        cron_expression: input.cron_expression.trim(),
        timezone: input.timezone.trim(),
        system_prompt: input.system_prompt.trim(),
        user_question: input.user_question.trim(),
        agent_id: input.agent_id,
        ...(input.market_listings_params != null && Object.keys(input.market_listings_params).length > 0
          ? { market_listings_params: input.market_listings_params as Record<string, unknown> }
          : {})
      };
      return {
        message:
          `Navrhl jsem naplánovanou úlohu „${draft.title}“ (${draft.cron_expression}, ${draft.timezone}). ` +
          `Potvrďte uložení níže v sekci „Data a grafy“ u této odpovědi, nebo v postranním panelu Nástroje → Úlohy (cron). Do databáze se záznam zapíše až po potvrzení.`,
        draft
      };
    }
  };

export const proposeScheduledAgentTaskTool: McpToolConfigEntry = {
  registryKey: "proposeScheduledAgentTask",
  tool: tool as McpTool<unknown, unknown>
};
