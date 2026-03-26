import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request);
    const params = await context.params;
    const conversationId = params.id;

    const supabase = getSupabaseAdminClient();
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (conversationError) throw new Error(conversationError.message);
    if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });

    const { data, error } = await supabase
      .from("conversation_messages")
      .select("id, role, content, metadata, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return Response.json(data ?? []);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
