import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { shouldRunScheduledTaskNow } from "@/lib/scheduled-tasks/cron-helpers";
import { runBackOfficeAgent } from "@/lib/agent/index";
import { logger } from "@/lib/observability/logger";
import { fetchMarketListings, mergeStoredMarketListingsParams } from "@/lib/agent/tools/market-listings-tool";
import type { MarketListing } from "@/lib/agent/tools/market-listing-model";
import { recordUserMarketListingFinds } from "@/lib/market-listings/record-user-market-listing-finds";
import {
  buildAgentPanelPersistPayload,
  type AgentPanelPersistPayloadV1
} from "@/lib/agent/conversation/agent-panel-persist";

export type ScheduledTaskRunResult = {
  taskId: string;
  status: "skipped" | "ok" | "error";
  detail?: string;
};

type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  cron_expression: string;
  timezone: string;
  system_prompt: string;
  user_question: string;
  agent_id: string;
  enabled: boolean;
  last_run_at: string | null;
  market_listings_params: unknown | null;
};

type ScheduledExecutionIntent =
  | "analytics"
  | "calendar_email"
  | "presentation"
  | "weekly_report"
  | "web_search"
  | "market_listings";

function parseScheduledExecutionIntentMarker(systemPrompt: string): {
  executionIntent?: ScheduledExecutionIntent;
  systemPromptWithoutMarker: string;
} {
  const markerRe = /\[\[SCHEDULED_EXECUTION_INTENT:(analytics|calendar_email|presentation|weekly_report|web_search|market_listings)\]\]/i;
  const m = markerRe.exec(systemPrompt);
  const executionIntent = (m?.[1]?.toLowerCase() ?? undefined) as ScheduledExecutionIntent | undefined;
  const systemPromptWithoutMarker = systemPrompt.replace(markerRe, "").trim();
  return { executionIntent, systemPromptWithoutMarker };
}

function formatListingsCronContext(listings: MarketListing[]): string {
  const maxLines = 35;
  const lines = listings.slice(0, maxLines).map((l) => `- ${l.title} | ${l.source} | ${l.url}`);
  const more = listings.length > maxLines ? `\n… a dalších ${listings.length - maxLines} nabídek.` : "";
  return `Počet stažených nabídek v tomto běhu: ${listings.length}\n${lines.join("\n")}${more}`;
}

async function insertNotification(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  row: {
    user_id: string;
    task_id: string;
    agent_run_id: string | null;
    status: "ok" | "error";
    summary: string;
    detail?: string | null;
    panel_payload?: AgentPanelPersistPayloadV1 | null;
  }
) {
  const { error } = await supabase.from("scheduled_task_run_notifications").insert({
    user_id: row.user_id,
    task_id: row.task_id,
    agent_run_id: row.agent_run_id,
    status: row.status,
    summary: row.summary.slice(0, 2000),
    /** Plný text odpovědi u úspěchu; u chyby krátká zpráva (API klient řeže délku). */
    detail: row.detail != null ? row.detail.slice(0, 200_000) : null,
    panel_payload: row.panel_payload ?? null
  });
  if (error) {
    logger.warn("scheduled_task_notification_insert_failed", { taskId: row.task_id, message: error.message });
  }
}

/**
 * Projde zapnuté úlohy a případně je spustí (stejná logika jako cron endpoint).
 * @param respectTimeWindow false = ruční spuštění, okno kolem cron tiknutí se neřeší
 * @param filterUserId jen úlohy daného uživatele (jinak všichni uživatelé — infrastrukturní cron)
 * @param filterTaskId jen jedna úloha (typicky s filterUserId u ručního spuštění z UI)
 * @param updateLastRunAtAfterSuccess jen u infrastrukturního cronu: uloží `last_run_at` pro kontrolu proti dvojímu
 *   spuštění ve stejném tiknutí. Ruční běhy mají `false`, aby neposouvaly kotvu a plánovaný cron dál běžel podle času.
 */
export async function runScheduledAgentTasksCycle(opts: {
  respectTimeWindow: boolean;
  filterUserId?: string;
  filterTaskId?: string;
  updateLastRunAtAfterSuccess?: boolean;
}): Promise<{ checkedAt: string; count: number; results: ScheduledTaskRunResult[]; loadError?: string }> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("user_scheduled_agent_tasks")
    .select(
      "id, user_id, title, cron_expression, timezone, system_prompt, user_question, agent_id, enabled, last_run_at, market_listings_params"
    )
    .eq("enabled", true);

  if (opts.filterUserId) {
    query = query.eq("user_id", opts.filterUserId);
  }
  if (opts.filterTaskId) {
    query = query.eq("id", opts.filterTaskId);
  }

  const { data: tasks, error } = await query;

  if (error) {
    return {
      checkedAt: new Date().toISOString(),
      count: 0,
      results: [],
      loadError: error.message
    };
  }

  const now = new Date();
  const results: ScheduledTaskRunResult[] = [];

  for (const row of (tasks ?? []) as TaskRow[]) {
    const lastRun = row.last_run_at ? new Date(row.last_run_at) : null;
    if (
      opts.respectTimeWindow &&
      !shouldRunScheduledTaskNow({ now, cronExpression: row.cron_expression, timezone: row.timezone, lastRunAt: lastRun })
    ) {
      results.push({ taskId: row.id, status: "skipped" });
      continue;
    }

    const { executionIntent, systemPromptWithoutMarker } = parseScheduledExecutionIntentMarker(row.system_prompt);
    const effectiveExecutionIntent = executionIntent ?? (row.market_listings_params ? "market_listings" : undefined);
    const executionIntentHint = effectiveExecutionIntent
      ? `\n[Rezim vykonu obsahu pro tento beh: POVINNE pouzij intent "${effectiveExecutionIntent}" (jde o obsah ulohy), pokud to neni technicky nemozne.]`
      : "";
    const prefix =
      "[Jednorázový běh již naplánované úlohy — opakování řeší pouze cron v infrastruktuře, ne ty. Neplánuj další cron úlohy, nevolaj nástroj proposeScheduledAgentTask a nežádej uživatele o nastavení opakování. Zpracuj jen tento jeden dotaz podle systémového zadání níže. Buď stručný, pokud zadání nevyžaduje jinak.]" +
      executionIntentHint +
      "\n" +
      systemPromptWithoutMarker;

    let listingsBlock = "";
    let listingsForRecord: MarketListing[] = [];
    const mergedParams = mergeStoredMarketListingsParams(row.market_listings_params);
    if (mergedParams) {
      try {
        const listings = await fetchMarketListings(mergedParams);
        listingsForRecord = listings;
        listingsBlock =
          "\n\n--- Kontext: nabídky stažené automaticky před odpovědí agenta (Sreality / Bezrealitky) ---\n" +
          formatListingsCronContext(listings) +
          "\n--- Konec kontextu nabídek — v odpovědi odkazuj jen na inzeráty z tohoto výpisu. ---\n";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        listingsBlock = `\n\n--- Upozornění: automatické stažení nabídek selhalo (${msg}). Pokračuj podle obecného zadání. ---\n`;
        logger.warn("scheduled_task_market_fetch_failed", { taskId: row.id, message: msg });
      }
    }

    const baseQuestion = row.user_question || "Splň naplánovanou úlohu podle systémového zadání.";
    const questionWithContext = listingsBlock ? `${baseQuestion}${listingsBlock}` : baseQuestion;

    try {
      const answer = await runBackOfficeAgent({
        userId: row.user_id,
        question: questionWithContext,
        agentId: row.agent_id === "thinking-orchestrator" ? "thinking-orchestrator" : "basic",
        orchestratorQuestionPrefix: prefix,
        scheduledTaskExecution: true
      });

      if (opts.updateLastRunAtAfterSuccess === true) {
        const { error: upErr } = await supabase
          .from("user_scheduled_agent_tasks")
          .update({ last_run_at: now.toISOString(), updated_at: now.toISOString() })
          .eq("id", row.id);

        if (upErr) {
          logger.warn("scheduled_task_last_run_update_failed", { taskId: row.id, message: upErr.message });
        }
      }

      results.push({ taskId: row.id, status: "ok" });
      logger.info("scheduled_agent_task_run_ok", { taskId: row.id, userId: row.user_id, title: row.title });

      if (listingsForRecord.length > 0) {
        void recordUserMarketListingFinds({
          userId: row.user_id,
          agentRunId: answer.runId ?? null,
          listings: listingsForRecord
        }).catch(() => {});
      }

      const full = answer.answer_text?.trim() ?? "";
      const summaryShort =
        full.length === 0 ? "Úloha doběhla." : full.length > 480 ? `${full.slice(0, 477)}…` : full;
      const panelPayload = buildAgentPanelPersistPayload(answer);
      await insertNotification(supabase, {
        user_id: row.user_id,
        task_id: row.id,
        agent_run_id: answer.runId ?? null,
        status: "ok",
        summary: summaryShort,
        detail: full.length > 0 ? full : null,
        panel_payload: panelPayload
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown";
      results.push({ taskId: row.id, status: "error", detail: message });
      logger.warn("scheduled_agent_task_run_failed", { taskId: row.id, userId: row.user_id, message });
      await insertNotification(supabase, {
        user_id: row.user_id,
        task_id: row.id,
        agent_run_id: null,
        status: "error",
        summary: "Chyba při běhu úlohy.",
        detail: message
      });
    }
  }

  return {
    checkedAt: now.toISOString(),
    count: results.length,
    results
  };
}
