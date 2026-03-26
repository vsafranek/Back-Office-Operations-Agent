import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

function resolveTargetPath(path: string, format: string) {
  const normalized = path.replace(/^\/+/, "");
  if (format === "pdf" && normalized.endsWith(".pptx")) {
    return normalized.replace(/\.pptx$/i, ".pdf");
  }
  if (format === "pptx" && normalized.endsWith(".pdf")) {
    return normalized.replace(/\.pdf$/i, ".pptx");
  }
  return normalized;
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser(request);
    const env = getEnv();
    const supabase = getSupabaseAdminClient();
    const url = new URL(request.url);
    const sourcePath = url.searchParams.get("path")?.trim();
    const format = (url.searchParams.get("format")?.trim() ?? "original").toLowerCase();

    if (!sourcePath) {
      return Response.json({ error: "Missing path query parameter." }, { status: 400 });
    }

    const targetPath = resolveTargetPath(sourcePath, format);
    if (!targetPath || targetPath.includes("..")) {
      return Response.json({ error: "Invalid path." }, { status: 400 });
    }
    const fileName = targetPath.split("/").pop() ?? "download";
    const signed = await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).createSignedUrl(targetPath, 300, {
      download: fileName
    });
    if (signed.error || !signed.data.signedUrl) {
      throw new Error(signed.error?.message ?? "Failed to create signed download URL.");
    }

    return Response.json({
      path: targetPath,
      signedUrl: signed.data.signedUrl,
      expiresInSeconds: 300
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
