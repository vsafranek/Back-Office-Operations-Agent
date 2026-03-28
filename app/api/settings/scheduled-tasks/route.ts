import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { validateCronExpression } from "@/lib/scheduled-tasks/cron-helpers";

export const runtime = "nodejs";

const taskBodySchema = z.object({
  title: z.string().min(1).max(200),
  cron_expression: z.string().min(1).max(120),
  timezone: z.string().min(1).max(80),
  system_prompt: z.string().min(1).max(12000),
  user_question: z.string().min(1).max(4000).optional(),
  agent_id: z.enum(["basic", "thinking-orchestrator"]).optional(),
  enabled: z.boolean().optional()
});

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_scheduled_agent_tasks")
      .select(
        "id, title, cron_expression, timezone, system_prompt, user_question, agent_id, enabled, last_run_at, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({ tasks: data ?? [] });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json();
    const parsed = taskBodySchema.parse(body);

    const cronCheck = validateCronExpression(parsed.cron_expression, parsed.timezone);
    if (!cronCheck.ok) {
      return Response.json({ error: cronCheck.error }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const row = {
      user_id: user.id,
      title: parsed.title.trim(),
      cron_expression: parsed.cron_expression.trim(),
      timezone: parsed.timezone.trim(),
      system_prompt: parsed.system_prompt.trim(),
      user_question: (parsed.user_question ?? "Splň naplánovanou úlohu podle systémového zadání.").trim(),
      agent_id: parsed.agent_id ?? "basic",
      enabled: parsed.enabled ?? true,
      updated_at: new Date().toISOString()
    };

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
