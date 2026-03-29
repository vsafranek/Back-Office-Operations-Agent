/**
 * Kalendář (čtení i zápis) + Gmail — stejné scope pro integrační OAuth i přihlášení přes Google u Supabase.
 * `calendar` = správa přístupných kalendářů a událostí v Google Calendar.
 */
export const GOOGLE_CALENDAR_GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.modify"
] as const;

export function googleOAuthIntegrationScopeString(): string {
  return GOOGLE_CALENDAR_GMAIL_SCOPES.join(" ");
}

/** openid + profil + integrační API pro signInWithOAuth(provider: google). */
export function googleSupabaseSignInScopeString(): string {
  return ["openid", "email", "profile", ...GOOGLE_CALENDAR_GMAIL_SCOPES].join(" ");
}
