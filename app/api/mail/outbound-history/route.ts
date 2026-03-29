import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

/**
 * Odchozí drafty / odeslání z aplikace (vazba na konverzaci).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("outbound_email_events")
      .select("id,conversation_id,agent_run_id,action,to_email,subject,body_excerpt,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ items: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer")
        ? 401
        : 400;
    return Response.json({ error: message }, { status });
  }
}
