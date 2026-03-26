import { randomUUID } from "node:crypto";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/system-prompt";
import type { AgentAnswer } from "@/lib/agent/types";
import { createEmailDraft } from "@/lib/agent/tools/email-tool";
import { generateReportArtifacts } from "@/lib/agent/tools/report-tool";
import { generatePresentationArtifact } from "@/lib/agent/tools/presentation-tool";
import { runSqlPreset } from "@/lib/agent/tools/sql-tool";
import { suggestViewingSlots } from "@/lib/agent/tools/calendar-tool";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export function detectIntent(question: string): "analytics" | "calendar_email" | "weekly_report" {
  const normalized = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("email") || normalized.includes("prohlidk")) return "calendar_email";
  if (normalized.includes("report") || normalized.includes("slid")) return "weekly_report";
  return "analytics";
}

function safeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function extractRequestedSlideCount(question: string): number | undefined {
  const normalized = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const digitMatch = normalized.match(/(\d{1,2})\s*(slide|slidu|slidy|stran|stranky)/);
  if (digitMatch) {
    const n = Number(digitMatch[1]);
    if (Number.isFinite(n)) return n;
  }

  const words: Record<string, number> = {
    dva: 2,
    tri: 3,
    ctyri: 4,
    pet: 5,
    sest: 6,
    sedm: 7,
    osm: 8,
    devet: 9,
    deset: 10
  };
  for (const [word, value] of Object.entries(words)) {
    if (normalized.includes(`${word} slid`)) return value;
  }
  return undefined;
}

function summarizeAnalytics(source: string, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return "Nenalezena zadna data pro tento dotaz.";
  }

  if (source === "vw_new_clients_q1") {
    const bySource = new Map<string, number>();
    for (const row of rows) {
      const key = safeText(row.source_channel) || "Neznamy zdroj";
      bySource.set(key, (bySource.get(key) ?? 0) + 1);
    }
    const lines = Array.from(bySource.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([channel, count]) => `- ${channel}: ${count}`)
      .join("\n");

    const sampleClients = rows
      .slice(0, 5)
      .map((row) => `- ${safeText(row.full_name) || "Klient"} (${safeText(row.source_channel) || "Neznamy zdroj"})`)
      .join("\n");

    return `Za 1. kvartal evidujeme ${rows.length} novych klientu.\n\nRozdeleni podle zdroje:\n${lines}\n\nPriklady klientu:\n${sampleClients}`;
  }

  if (source === "vw_leads_vs_sales_6m") {
    let totalLeads = 0;
    let totalSold = 0;
    const trendLines = rows
      .map((row) => {
        const leads = Number(row.leads_count ?? 0);
        const sold = Number(row.sold_count ?? 0);
        totalLeads += leads;
        totalSold += sold;
        return `- ${safeText(row.month)}: leads ${leads}, prodane ${sold}`;
      })
      .join("\n");

    return `Za poslednich 6 mesicu: leads ${totalLeads}, prodane nemovitosti ${totalSold}.\n\nMesicni vyvoj:\n${trendLines}`;
  }

  if (source === "fn_missing_reconstruction_data()") {
    const list = rows
      .slice(0, 20)
      .map((row) => `- ${safeText(row.title)} (${safeText(row.city)})`)
      .join("\n");
    return `Nalezeno ${rows.length} nemovitosti s chybejicimi udaji o rekonstrukci/stavebnich upravach.\n\nSeznam k doplneni:\n${list}`;
  }

  return `Nalezeno ${rows.length} radku dat.`;
}

async function loadConversationContext(params: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  conversationId: string | null;
}) {
  if (!params.conversationId) return "";
  const { data, error } = await params.supabase
    .from("conversation_messages")
    .select("role, content")
    .eq("conversation_id", params.conversationId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error || !data) return "";

  return data
    .reverse()
    .map((msg) => `${safeText(msg.role)}: ${safeText(msg.content)}`)
    .join("\n");
}

export async function runBackOfficeAgent(input: { userId: string; question: string; conversationId?: string }): Promise<AgentAnswer> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const intent = detectIntent(input.question);
  const supabase = getSupabaseAdminClient();
  const conversationId = input.conversationId ?? null;

  logger.info("agent_run_started", { runId, userId: input.userId, intent });

  if (conversationId) {
    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: input.question,
      metadata: { runId, intent }
    });
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("user_id", input.userId);
  }

  let answer: AgentAnswer;
  const contextText = await loadConversationContext({ supabase, conversationId });

  if (intent === "calendar_email") {
    const slots = await suggestViewingSlots({ userId: input.userId, daysAhead: 7, limit: 3 });
    const recommended = slots[0];

    const llm = await generateWithAzureProxy({
      runId,
      messages: [
        { role: "system", content: AGENT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Napis kratky cesky email zajemci o nemovitost. Nabidni termin: ${recommended?.start ?? "dohodou"}.\n\nHistorie:\n${contextText}`
        }
      ]
    });

    const draft = await createEmailDraft({
      userId: input.userId,
      to: "lead@example.com",
      subject: "Navrh terminu prohlidky nemovitosti",
      body: llm.text
    });

    answer = {
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
  } else if (intent === "weekly_report") {
    const requestedSlideCount = extractRequestedSlideCount(input.question);
    const resolvedSlideCount = Math.min(15, Math.max(2, requestedSlideCount ?? 5));
    const data = await runSqlPreset({ question: "lead prodane 6 mesic", runId });
    const report = await generateReportArtifacts({
      runId,
      title: "Tydenni executive report",
      rows: data.rows
    });
    const presentation = await generatePresentationArtifact({
      runId,
      title: "Tydenni executive report",
      rows: data.rows,
      context: input.question,
      slideCount: resolvedSlideCount
    });

    answer = {
      answer_text: `Tydenni report byl vygenerovan vcetne podkladovych dat a prezentace (${resolvedSlideCount} slidu) v cestine.`,
      confidence: 0.8,
      sources: [data.source],
      generated_artifacts: [
        { type: "report", label: "CSV dataset", url: report.csvPublic },
        { type: "report", label: "Markdown summary", url: report.mdPublic },
        { type: "presentation", label: `Prezentace (${resolvedSlideCount} slidu) PPTX`, url: presentation.publicUrl },
        { type: "presentation", label: `Prezentace (${resolvedSlideCount} slidu) PDF`, url: presentation.pdfPublicUrl }
      ],
      next_actions: ["Zkontroluj navrzeny obsah slidu a uprav finalni verzi pro vedeni."]
    };
  } else {
    const data = await runSqlPreset({ question: input.question, runId });
    const report = await generateReportArtifacts({
      runId,
      title: "Ad-hoc analyticky vystup",
      rows: data.rows
    });

    answer = {
      answer_text: summarizeAnalytics(data.source, data.rows),
      confidence: data.rows.length > 0 ? 0.86 : 0.55,
      sources: [data.source],
      generated_artifacts: [
        { type: "table", label: "Dataset CSV", url: report.csvPublic },
        { type: "chart", label: "Summary markdown", url: report.mdPublic }
      ],
      next_actions: data.rows.length === 0 ? ["Dopln data ve zdrojovych tabulkach a spust dotaz znovu."] : ["Mohu rovnou pripravit executive report."]
    };
  }

  const finishedAt = new Date().toISOString();
  const { error } = await supabase.from("agent_runs").insert({
    run_id: runId,
    user_id: input.userId,
    question: input.question,
    intent,
    answer: answer.answer_text,
    confidence: answer.confidence,
    sources: answer.sources,
    created_at: startedAt,
    finished_at: finishedAt
  });

  if (error) {
    logger.warn("agent_run_audit_failed", { runId, message: error.message });
  }

  if (conversationId) {
    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: answer.answer_text,
      metadata: {
        runId,
        intent,
        confidence: answer.confidence,
        sources: answer.sources,
        generated_artifacts: answer.generated_artifacts,
        next_actions: answer.next_actions
      }
    });
    await supabase
      .from("conversations")
      .update({
        updated_at: new Date().toISOString(),
        title: input.question.slice(0, 60)
      })
      .eq("id", conversationId)
      .eq("user_id", input.userId);
  }

  logger.info("agent_run_finished", { runId, confidence: answer.confidence });
  return answer;
}
