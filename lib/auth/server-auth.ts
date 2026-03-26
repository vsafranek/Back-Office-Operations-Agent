import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export async function requireAuthenticatedUser(request: Request): Promise<{ id: string; email?: string }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing Bearer token.");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Unauthorized.");
  }

  return {
    id: data.user.id,
    email: data.user.email ?? undefined
  };
}
