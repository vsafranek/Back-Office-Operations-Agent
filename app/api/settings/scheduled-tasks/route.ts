import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { normalizeUserCronExpression, validateCronExpression } from "@/lib/scheduled-tasks/cron-helpers";

export const runtime = "nodejs";

const taskBodySchema = z.object({
  title: z.string().min(1).max(200),
  cron_expression: z.string().min(1).max(120),
  timezone: z.string().min(1).max(80),
  system_prompt: z.string().min(1).max(12000),
  user_question: z.string().min(1).max(4000).optional(),
  agent_id: z.enum(["basic", "thinking-orchestrator"]).optional(),
  enabled: z.boolean().optional(),
  market_listings_params: z.record(z.string(), z.unknown()).nullable().optional()
});

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_scheduled_agent_tasks")
      .select(
        "id, title, cron_expression, timezone, system_prompt, user_question, agent_id, enabled, last_run_at, created_at, updated_at, market_listings_params"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const tasks = data ?? [];
    const taskIds = tasks.map((t) => t.id).filter(Boolean) as string[];
    const runCountByTask: Record<string, number> = {};
    const lastNotifByTask: Record<string, string> = {};

    if (taskIds.length > 0) {
      const { data: notifRows, error: notifErr } = await supabase
        .from("scheduled_task_run_notifications")
        .select("task_id, created_at")
        .eq("user_id", user.id)
        .in("task_id", taskIds);

      if (notifErr) {
        throw new Error(notifErr.message);
      }

      for (const row of notifRows ?? []) {
        const tid = row.task_id as string;
        runCountByTask[tid] = (runCountByTask[tid] ?? 0) + 1;
        const created = row.created_at as string;
        const prev = lastNotifByTask[tid];
        if (!prev || created > prev) {
          lastNotifByTask[tid] = created;
        }
      }
    }

    type TaskRow = (typeof tasks)[number] & { last_run_at?: string | null };
    const enriched = (tasks as TaskRow[]).map((t) => {
      const notifLast = lastNotifByTask[t.id] ?? null;
      const tableLast = t.last_run_at ?? null;
      return {
        ...t,
        run_count: runCountByTask[t.id] ?? 0,
        last_event_at: notifLast ?? tableLast
      };
    });

    return Response.json({ tasks: enriched });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json();
    const parsed = taskBodySchema.parse(body);
    const normalizedCronExpression = normalizeUserCronExpression(parsed.cron_expression);

    const cronCheck = validateCronExpression(normalizedCronExpression, parsed.timezone);
    if (!cronCheck.ok) {
      return Response.json({ error: cronCheck.error }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const row: Record<string, unknown> = {
      user_id: user.id,
      title: parsed.title.trim(),
      cron_expression: normalizedCronExpression,
      timezone: parsed.timezone.trim(),
      system_prompt: parsed.system_prompt.trim(),
      user_question: (parsed.user_question ?? "Splň naplánovanou úlohu podle systémového zadání.").trim(),
      agent_id: parsed.agent_id ?? "basic",
      enabled: parsed.enabled ?? true,
      updated_at: new Date().toISOString()
    };
    if (parsed.market_listings_params !== undefined) {
      row.market_listings_params = parsed.market_listings_params;
    }

    const { data, error } = await supabase.from("user_scheduled_agent_tasks").insert(row).select().single();

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({ task: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
