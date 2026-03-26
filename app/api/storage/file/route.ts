import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    await requireAuthenticatedUser(request);
    const env = getEnv();
    const supabase = getSupabaseAdminClient();
    const url = new URL(request.url);
    const path = url.searchParams.get("path")?.trim().replace(/^\/+/, "");

    if (!path || path.includes("..")) {
      return Response.json({ error: "Invalid path." }, { status: 400 });
    }

    const deleted = await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([path]);
    if (deleted.error) {
      throw new Error(deleted.error.message);
    }
    return Response.json({ ok: true, deleted: path });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
