"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useEffect } from "react";
import { syncLoginProviderIntegrationFromSession } from "@/lib/auth/sync-login-provider-integration-client";

/**
 * Po načtení stránky a při SIGNED_IN doplní integraci (Gmail/Calendar nebo Outlook) z provider_token relace.
 */
export function useSyncLoginProviderIntegration(supabase: SupabaseClient) {
  useEffect(() => {
    function run(session: Session | null) {
      if (!session) return;
      void syncLoginProviderIntegrationFromSession(session);
    }

    void supabase.auth.getSession().then(({ data }) => run(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        run(session);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);
}
