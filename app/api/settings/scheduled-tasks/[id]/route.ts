import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { validateCronExpression } from "@/lib/scheduled-tasks/cron-helpers";

export const runtime = "nodejs";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  cron_expression: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).max(80).optional(),
  system_prompt: z.string().min(1).max(12000).optional(),
  user_question: z.string().min(1).max(4000).optional(),
  agent_id: z.enum(["basic", "thinking-orchestrator"]).optional(),
  enabled: z.boolean().optional()
});

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { id } = await ctx.params;
    const body = await request.json();
    const parsed = patchSchema.parse(body);

    if (parsed.cron_expression !== undefined || parsed.timezone !== undefined) {
      const supabase = getSupabaseAdminClient();
      const { data: existing, error: fetchErr } = await supabase
        .from("user_scheduled_agent_tasks")
        .select("cron_expression, timezone")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchErr || !existing) {
        return Response.json({ error: "Úloha nenalezena." }, { status: 404 });
      }

      const expr = parsed.cron_expression ?? existing.cron_expression;
      const tz = parsed.timezone ?? existing.timezone;
      const cronCheck = validateCronExpression(expr, tz);
      if (!cronCheck.ok) {
        return Response.json({ error: cronCheck.error }, { status: 400 });
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.title !== undefined) updates.title = parsed.title.trim();
    if (parsed.cron_expression !== undefined) updates.cron_expression = parsed.cron_expression.trim();
    if (parsed.timezone !== undefined) updates.timezone = parsed.timezone.trim();
    if (parsed.system_prompt !== undefined) updates.system_prompt = parsed.system_prompt.trim();
    if (parsed.user_question !== undefined) updates.user_question = parsed.user_question.trim();
    if (parsed.agent_id !== undefined) updates.agent_id = parsed.agent_id;
    if (parsed.enabled !== undefined) updates.enabled = parsed.enabled;

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_scheduled_agent_tasks")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return Response.json({ error: "Úloha nenalezena." }, { status: 404 });
    }

    return Response.json({ task: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { id } = await ctx.params;
    const supabase = getSupabaseAdminClient();
    const { data: deleted, error } = await supabase
      .from("user_scheduled_agent_tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      throw new Error(error.message);
    }
    if (!deleted?.length) {
      return Response.json({ error: "Úloha nenalezena." }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
