import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export type AuthenticatedUser = { id: string; email?: string };

export function readBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function getAuthenticatedUserFromRequest(request: Request): Promise<AuthenticatedUser | null> {
  const token = readBearerToken(request);
  if (!token) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email ?? undefined
  };
}

export async function requireAuthenticatedUser(request: Request): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) {
    throw new Error("Unauthorized.");
  }
  return user;
}
