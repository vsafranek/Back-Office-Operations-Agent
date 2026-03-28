import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export type UserIntegrationSettingsRow = {
  user_id: string;
  calendar_provider: string;
  calendar_account_email: string | null;
  calendar_id: string | null;
  mail_provider: string;
  mail_from_email: string | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  microsoft_access_token: string | null;
  microsoft_refresh_token: string | null;
  updated_at: string;
  created_at: string;
};

export async function fetchUserIntegrationSettings(userId: string): Promise<UserIntegrationSettingsRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_integration_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read user integration settings: ${error.message}`);
  }

  return (data ?? null) as UserIntegrationSettingsRow | null;
}
