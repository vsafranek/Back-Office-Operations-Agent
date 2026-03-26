import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

type Body = { paths?: string[] };

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    await requireAuthenticatedUser(request);
    const env = getEnv();
    const supabase = getSupabaseAdminClient();
    const body = (await request.json()) as Body;
    const paths = (body.paths ?? []).map((p) => p.trim().replace(/^\/+/, "")).filter(Boolean);

    if (paths.length === 0) {
      return Response.json({ error: "No paths provided." }, { status: 400 });
    }
    if (paths.length > 100) {
      return Response.json({ error: "Too many paths. Max 100." }, { status: 400 });
    }
    if (paths.some((path) => path.includes(".."))) {
      return Response.json({ error: "Invalid path." }, { status: 400 });
    }

    const removed = await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).remove(paths);
    if (removed.error) {
      throw new Error(removed.error.message);
    }
    return Response.json({ ok: true, deletedCount: paths.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
