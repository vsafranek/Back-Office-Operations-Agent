import { decryptToken, encryptToken } from "@/lib/security/token-crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { fetchUserIntegrationSettings } from "@/lib/integrations/user-integration-settings";

function pickEmail(profileEmail: string | null, existingEmail: string | null | undefined): string | null {
  const p = profileEmail?.trim();
  if (p) return p;
  const e = existingEmail?.trim();
  return e || null;
}

/**
 * Po odpojení tokenu sjednotí calendar_provider / mail_provider podle toho, co zůstalo připojené.
 */
export async function reconcileIntegrationProviders(userId: string): Promise<void> {
  const existing = await fetchUserIntegrationSettings(userId);
  if (!existing) return;

  const hasGoogle = Boolean(existing.google_access_token || existing.google_refresh_token);
  const hasMs = Boolean(existing.microsoft_access_token || existing.microsoft_refresh_token);

  let calendar_provider: string;
  let mail_provider: string;

  if (hasGoogle && hasMs) {
    if (existing.calendar_provider === "microsoft") {
      calendar_provider = "microsoft";
      mail_provider = "outlook";
    } else {
      calendar_provider = "google";
      mail_provider = "gmail";
    }
  } else if (hasGoogle) {
    calendar_provider = "google";
    mail_provider = "gmail";
  } else if (hasMs) {
    calendar_provider = "microsoft";
    mail_provider = "outlook";
  } else {
    calendar_provider = "google";
    mail_provider = "gmail";
  }

  if (calendar_provider === existing.calendar_provider && mail_provider === existing.mail_provider) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("user_integration_settings")
    .update({
      calendar_provider,
      mail_provider,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Uloží Google tokeny a nastaví Google jako aktivní kalendář i poštu (bez ručního formuláře).
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
  const email = pickEmail(params.profileEmail, existing?.calendar_account_email);

  const { error } = await supabase.from("user_integration_settings").upsert({
    user_id: params.userId,
    calendar_provider: "google",
    mail_provider: "gmail",
    calendar_account_email: email,
    calendar_id: existing?.calendar_id?.trim() || "primary",
    mail_from_email: email,
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

/**
 * Uloží Microsoft tokeny a nastaví Microsoft jako aktivní kalendář i poštu (bez ručního formuláře).
 */
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
  const email = pickEmail(params.profileEmail, existing?.calendar_account_email);

  const { error } = await supabase.from("user_integration_settings").upsert({
    user_id: params.userId,
    calendar_provider: "microsoft",
    mail_provider: "outlook",
    calendar_account_email: email,
    calendar_id: existing?.calendar_id?.trim() || "primary",
    mail_from_email: email,
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

  await reconcileIntegrationProviders(userId);
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

  await reconcileIntegrationProviders(userId);
}
