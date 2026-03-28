import { getEnv } from "@/lib/config/env";
import { encryptToken, decryptToken } from "@/lib/security/token-crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

const GRAPH_SCOPE =
  "offline_access openid profile email https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/Mail.ReadWrite";

export function getMicrosoftOAuthScopes() {
  return GRAPH_SCOPE;
}

export async function getMicrosoftAccessTokenForUser(params: { userId: string }): Promise<string> {
  const env = getEnv();
  if (!env.MICROSOFT_OAUTH_CLIENT_ID || !env.MICROSOFT_OAUTH_CLIENT_SECRET) {
    throw new Error("Microsoft OAuth is not configured (MICROSOFT_OAUTH_CLIENT_ID / MICROSOFT_OAUTH_CLIENT_SECRET).");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_integration_settings")
    .select("microsoft_access_token, microsoft_refresh_token")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read user integration settings: ${error.message}`);
  }

  const access = decryptToken(data?.microsoft_access_token ?? null);
  const refresh = decryptToken(data?.microsoft_refresh_token ?? null);

  if (!access && !refresh) {
    throw new Error("Microsoft 365 není připojené. Připojte účet v Nastavení integrací.");
  }

  if (access && !refresh) {
    return access;
  }

  if (!refresh) {
    throw new Error("Microsoft 365: chybí refresh token; připojte účet znovu v nastavení.");
  }

  const tenant = env.MICROSOFT_OAUTH_TENANT ?? "common";
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_OAUTH_CLIENT_ID,
    client_secret: env.MICROSOFT_OAUTH_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refresh,
    scope: GRAPH_SCOPE
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const desc = typeof json.error_description === "string" ? json.error_description : JSON.stringify(json);
    throw new Error(`Microsoft token refresh failed: ${desc}`);
  }

  const newAccess = typeof json.access_token === "string" ? json.access_token : null;
  const newRefresh = typeof json.refresh_token === "string" ? json.refresh_token : refresh;

  if (!newAccess) {
    throw new Error("Microsoft token refresh returned no access_token.");
  }

  await supabase
    .from("user_integration_settings")
    .update({
      microsoft_access_token: encryptToken(newAccess),
      microsoft_refresh_token: encryptToken(newRefresh),
      updated_at: new Date().toISOString()
    })
    .eq("user_id", params.userId);

  return newAccess;
}
