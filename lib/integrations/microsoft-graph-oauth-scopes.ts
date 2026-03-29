/**
 * Delegovaná oprávnění Microsoft Graph — kalendář (zápis) + pošta + refresh.
 * Jedna definice pro integrační OAuth i přihlášení přes Azure u Supabase.
 */
export const MICROSOFT_GRAPH_INTEGRATION_SCOPES =
  "offline_access openid profile email https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/Mail.ReadWrite";
