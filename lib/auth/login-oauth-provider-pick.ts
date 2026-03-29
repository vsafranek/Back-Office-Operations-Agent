import type { User } from "@supabase/supabase-js";

/**
 * OAuth poskytovatel odpovídající aktuální relaci s provider_token (nejnovější google/azure identita).
 */
export function pickLoginOAuthProviderForSession(user: User): "google" | "azure" | null {
  const ids = user.identities ?? [];
  const oauth = ids.filter((i) => i.provider === "google" || i.provider === "azure");
  if (oauth.length > 0) {
    const sorted = [...oauth].sort((a, b) => {
      const ta = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
      const tb = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
      return tb - ta;
    });
    const p = sorted[0]!.provider;
    if (p === "google") return "google";
    if (p === "azure") return "azure";
  }

  const primary = user.app_metadata?.provider;
  if (primary === "google" || primary === "azure") return primary;

  const list = user.app_metadata?.providers;
  if (Array.isArray(list)) {
    if (list.includes("google")) return "google";
    if (list.includes("azure")) return "azure";
  }

  return null;
}
