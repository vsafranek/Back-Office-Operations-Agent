import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

type Body = {
  paths?: string[];
  format?: "original" | "pdf" | "pptx";
};

function resolveTargetPath(path: string, format: string) {
  if (format === "pdf" && path.endsWith(".pptx")) return path.replace(/\.pptx$/i, ".pdf");
  if (format === "pptx" && path.endsWith(".pdf")) return path.replace(/\.pdf$/i, ".pptx");
  return path;
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser(request);
    const env = getEnv();
    const supabase = getSupabaseAdminClient();
    const body = (await request.json()) as Body;
    const format = body.format ?? "original";
    const paths = (body.paths ?? []).map((p) => p.trim().replace(/^\/+/, "")).filter(Boolean);
    if (paths.length === 0) {
      return Response.json({ error: "No paths provided." }, { status: 400 });
    }
    if (paths.length > 50) {
      return Response.json({ error: "Too many paths. Max 50." }, { status: 400 });
    }

    const results: Array<{ sourcePath: string; path?: string; signedUrl?: string; error?: string }> = [];
    for (const sourcePath of paths) {
      if (sourcePath.includes("..")) {
        results.push({ sourcePath, error: "Invalid path." });
        continue;
      }
      const path = resolveTargetPath(sourcePath, format);
      const fileName = path.split("/").pop() ?? "download";
      const signed = await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).createSignedUrl(path, 300, {
        download: fileName
      });
      if (signed.error || !signed.data.signedUrl) {
        results.push({ sourcePath, path, error: signed.error?.message ?? "Failed to sign URL." });
      } else {
        results.push({ sourcePath, path, signedUrl: signed.data.signedUrl });
      }
    }

    return Response.json({ results, expiresInSeconds: 300 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
