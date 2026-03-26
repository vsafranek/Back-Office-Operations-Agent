import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

const renameSchema = z.object({
  title: z.string().min(1).max(120)
});

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request);
    const params = await context.params;
    const body = await request.json();
    const parsed = renameSchema.parse(body);
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("conversations")
      .update({
        title: parsed.title,
        updated_at: new Date().toISOString()
      })
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select("id, title, created_at, updated_at")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return Response.json({ error: "Conversation not found." }, { status: 404 });

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request);
    const params = await context.params;
    const supabase = getSupabaseAdminClient();

    const { data: existing, error: checkError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (checkError) throw new Error(checkError.message);
    if (!existing) return Response.json({ error: "Conversation not found." }, { status: 404 });

    const { error } = await supabase.from("conversations").delete().eq("id", params.id).eq("user_id", user.id);
    if (error) throw new Error(error.message);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
