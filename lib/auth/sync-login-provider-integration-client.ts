"use client";

import type { Session } from "@supabase/supabase-js";
import { pickLoginOAuthProviderForSession } from "@/lib/auth/login-oauth-provider-pick";

/** Po OAuth přihlášení přes Supabase uloží stejné tokeny do integrací (user_integration_settings). */
export async function syncLoginProviderIntegrationFromSession(session: Session): Promise<void> {
  const token = session.provider_token;
  if (!token?.trim()) return;

  const provider = pickLoginOAuthProviderForSession(session.user);
  if (!provider) return;

  const refresh = session.provider_refresh_token ?? null;

  await fetch("/api/auth/sync-login-provider-integration", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      provider,
      accessToken: token,
      refreshToken: refresh
    })
  }).catch(() => {});
}
