import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

const patchSchema = z.object({
  mark_read_ids: z.array(z.string().uuid()).optional(),
  mark_all_read: z.boolean().optional()
});

/** Seznam upozornění z běhů cronu + označení přečtení. */
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const url = new URL(request.url);
    const supabase = getSupabaseAdminClient();

    if (url.searchParams.get("count_only") === "1") {
      const { count: unreadCount, error: countErr } = await supabase
        .from("scheduled_task_run_notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (countErr) throw new Error(countErr.message);
      return Response.json({ unread_count: unreadCount ?? 0 });
    }

    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));

    const { count: unreadCount, error: countErr } = await supabase
      .from("scheduled_task_run_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (countErr) throw new Error(countErr.message);

    const { data, error } = await supabase
      .from("scheduled_task_run_notifications")
      .select(
        "id, task_id, agent_run_id, status, summary, detail, read_at, created_at, user_scheduled_agent_tasks(title, cron_expression)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    type TaskEmbed = { title?: string | null; cron_expression?: string | null };
    type RawRow = {
      id: string;
      task_id: string;
      agent_run_id: string | null;
      status: string;
      summary: string;
      detail: string | null;
      read_at: string | null;
      created_at: string;
      user_scheduled_agent_tasks: TaskEmbed | TaskEmbed[] | null;
    };

    function taskFromEmbed(embed: RawRow["user_scheduled_agent_tasks"]): TaskEmbed | null {
      if (embed == null) return null;
      return Array.isArray(embed) ? (embed[0] ?? null) : embed;
    }

    const rows = (data ?? []) as RawRow[];

    const notifications = rows.map((r) => {
      const task = taskFromEmbed(r.user_scheduled_agent_tasks);
      return {
      id: r.id,
      task_id: r.task_id,
      task_title: task?.title ?? "Úloha",
      task_cron: task?.cron_expression ?? "",
      agent_run_id: r.agent_run_id,
      status: r.status as "ok" | "error",
      summary: r.summary,
      detail: r.detail,
      read_at: r.read_at,
      created_at: r.created_at
    };
    });

    return Response.json({ notifications, unread_count: unreadCount ?? 0 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json();
    const parsed = patchSchema.parse(body);
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();

    if (parsed.mark_all_read) {
      const { error } = await supabase
        .from("scheduled_task_run_notifications")
        .update({ read_at: now })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (error) throw new Error(error.message);
      return Response.json({ ok: true });
    }

    if (parsed.mark_read_ids?.length) {
      const { error } = await supabase
        .from("scheduled_task_run_notifications")
        .update({ read_at: now })
        .eq("user_id", user.id)
        .in("id", parsed.mark_read_ids);
      if (error) throw new Error(error.message);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Chybí mark_read_ids nebo mark_all_read." }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
