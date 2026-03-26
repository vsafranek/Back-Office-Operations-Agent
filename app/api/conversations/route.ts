import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

const createConversationSchema = z.object({
  title: z.string().min(1).max(120).optional()
});

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return Response.json(data ?? []);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const parsed = createConversationSchema.parse(body);
    const title = parsed.title ?? "Nova konverzace";

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title })
      .select("id, title, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
