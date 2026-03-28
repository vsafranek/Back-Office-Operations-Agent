import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export type SenderProfile = {
  displayName: string;
  email: string | null;
};

/**
 * Jméno a e-mail přihlášeného uživatele pro podpis e-mailu (service role).
 */
export async function getSenderProfileForCalendarEmail(userId: string): Promise<SenderProfile> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    return { displayName: "Váš realitní tým", email: null };
  }
  const u = data.user;
  const meta = u.user_metadata as Record<string, unknown> | undefined;
  const fromMeta =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim()) ||
    (typeof meta?.display_name === "string" && meta.display_name.trim()) ||
    "";
  const email = u.email ?? null;
  const displayName =
    fromMeta ||
    (email ? email.split("@")[0]!.replace(/\./g, " ") : "") ||
    "Váš realitní tým";
  return { displayName, email };
}
