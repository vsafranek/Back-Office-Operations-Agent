import { google } from "googleapis";
import { getEnv } from "@/lib/config/env";
import { encryptToken, decryptToken } from "@/lib/security/token-crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

type UserSettingsRow = {
  calendar_account_email: string | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
};

function getServiceAccountAuth(scopes: string[]) {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PRIVATE_KEY || !env.GOOGLE_IMPERSONATED_USER) {
    throw new Error("Google Workspace variables are not configured.");
  }

  return new google.auth.JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    subject: env.GOOGLE_IMPERSONATED_USER,
    scopes
  });
}

export async function getGoogleAuthForUser(params: { userId: string; scopes: string[] }) {
  const env = getEnv();
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("user_integration_settings")
    .select("calendar_account_email, google_access_token, google_refresh_token")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read user integration settings: ${error.message}`);
  }

  const row = (data ?? null) as UserSettingsRow | null;
  const decryptedAccessToken = decryptToken(row?.google_access_token ?? null);
  const decryptedRefreshToken = decryptToken(row?.google_refresh_token ?? null);
  const calendarId = row?.calendar_account_email || env.GOOGLE_CALENDAR_ID;

  if (!decryptedAccessToken && !decryptedRefreshToken) {
    return {
      auth: getServiceAccountAuth(params.scopes),
      calendarId: env.GOOGLE_CALENDAR_ID
    };
  }

  // Access-token-only mode: works immediately after OAuth login.
  // Refresh-token mode requires OAuth client credentials.
  if ((!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) && decryptedAccessToken) {
    const tokenOnlyClient = new google.auth.OAuth2();
    tokenOnlyClient.setCredentials({
      access_token: decryptedAccessToken
    });
    return {
      auth: tokenOnlyClient,
      calendarId
    };
  }

  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error(
      "Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET. Add them to enable refresh-token auth."
    );
  }

  const oauth2Client = new google.auth.OAuth2(env.GOOGLE_OAUTH_CLIENT_ID, env.GOOGLE_OAUTH_CLIENT_SECRET);
  oauth2Client.setCredentials({
    access_token: decryptedAccessToken ?? undefined,
    refresh_token: decryptedRefreshToken ?? undefined
  });

  if (decryptedRefreshToken) {
    const refreshed = await oauth2Client.getAccessToken();
    if (refreshed.token && refreshed.token !== decryptedAccessToken) {
      await supabase
        .from("user_integration_settings")
        .update({
          google_access_token: encryptToken(refreshed.token),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", params.userId);
    }
  }

  return {
    auth: oauth2Client,
    calendarId
  };
}
