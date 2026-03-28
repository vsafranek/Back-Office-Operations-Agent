import { decryptToken, encryptToken } from "@/lib/security/token-crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { fetchUserIntegrationSettings } from "@/lib/integrations/user-integration-settings";

/**
 * Sloučí existující řádek s novými tokeny / e-maily. Nepřepisuje calendar_provider / mail_provider,
 * pokud už řádek existuje (uživatel je vybírá v nastavení).
 */
export async function persistGoogleOAuthTokens(params: {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  profileEmail: string | null;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const existing = await fetchUserIntegrationSettings(params.userId);
  const prevRefresh = existing?.google_refresh_token ? decryptToken(existing.google_refresh_token) : null;
  const refresh = params.refreshToken?.trim() || prevRefresh || null;

  const { error } = await supabase.from("user_integration_settings").upsert({
    user_id: params.userId,
    calendar_provider: existing?.calendar_provider ?? "google",
    mail_provider: existing?.mail_provider ?? "gmail",
    calendar_account_email: existing?.calendar_account_email?.trim() || params.profileEmail,
    calendar_id: existing?.calendar_id ?? "primary",
    mail_from_email: existing?.mail_from_email?.trim() || params.profileEmail,
    google_access_token: encryptToken(params.accessToken),
    google_refresh_token: encryptToken(refresh),
    microsoft_access_token: existing?.microsoft_access_token ?? null,
    microsoft_refresh_token: existing?.microsoft_refresh_token ?? null,
    updated_at: new Date().toISOString(),
    created_at: existing?.created_at ?? new Date().toISOString()
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function persistMicrosoftOAuthTokens(params: {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  profileEmail: string | null;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const existing = await fetchUserIntegrationSettings(params.userId);
  const prevRefresh = existing?.microsoft_refresh_token ? decryptToken(existing.microsoft_refresh_token) : null;
  const refresh = params.refreshToken?.trim() || prevRefresh || null;

  const { error } = await supabase.from("user_integration_settings").upsert({
    user_id: params.userId,
    calendar_provider: existing?.calendar_provider ?? "microsoft",
    mail_provider: existing?.mail_provider ?? "outlook",
    calendar_account_email: existing?.calendar_account_email?.trim() || params.profileEmail,
    calendar_id: existing?.calendar_id ?? "primary",
    mail_from_email: existing?.mail_from_email?.trim() || params.profileEmail,
    google_access_token: existing?.google_access_token ?? null,
    google_refresh_token: existing?.google_refresh_token ?? null,
    microsoft_access_token: encryptToken(params.accessToken),
    microsoft_refresh_token: encryptToken(refresh),
    updated_at: new Date().toISOString(),
    created_at: existing?.created_at ?? new Date().toISOString()
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function clearGoogleIntegrationTokens(userId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const existing = await fetchUserIntegrationSettings(userId);
  if (!existing) return;

  const { error } = await supabase
    .from("user_integration_settings")
    .update({
      google_access_token: null,
      google_refresh_token: null,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function clearMicrosoftIntegrationTokens(userId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("user_integration_settings")
    .update({
      microsoft_access_token: null,
      microsoft_refresh_token: null,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}
