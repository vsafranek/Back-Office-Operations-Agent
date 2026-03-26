import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/config/env";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export function getSupabaseAdminClient() {
  const env = getEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
