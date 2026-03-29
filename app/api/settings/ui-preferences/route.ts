import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

const patchSchema = z.object({
  presentation_opening_slide: z.boolean()
});

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("user_ui_preferences")
      .select("presentation_opening_slide")
      .eq("user_id", user.id)
      .maybeSingle();
    return Response.json({
      presentation_opening_slide: data?.presentation_opening_slide !== false
    });
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
    const { error } = await supabase.from("user_ui_preferences").upsert(
      {
        user_id: user.id,
        presentation_opening_slide: parsed.presentation_opening_slide,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );
    if (error) throw new Error(error.message);
    return Response.json({ ok: true, presentation_opening_slide: parsed.presentation_opening_slide });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
