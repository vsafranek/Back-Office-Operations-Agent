import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Odchozí drafty / odeslání z aplikace (vazba na konverzaci).
 * Query: `conversationId` — jen události pro danou konverzaci (sledování kontaktů v chatu).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const url = new URL(request.url);
    const conv = url.searchParams.get("conversationId")?.trim() ?? "";
    const filterConv = UUID_RE.test(conv) ? conv : null;

    const supabase = getSupabaseAdminClient();
    let q = supabase
      .from("outbound_email_events")
      .select("id,conversation_id,agent_run_id,action,to_email,subject,body_excerpt,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(filterConv ? 80 : 40);
    if (filterConv) {
      q = q.eq("conversation_id", filterConv);
    }
    const { data, error } = await q;
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
