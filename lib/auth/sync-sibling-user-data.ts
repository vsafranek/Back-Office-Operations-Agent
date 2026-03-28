import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import type { UserIntegrationSettingsRow } from "@/lib/integrations/user-integration-settings";

type IdRow = { user_id: string };

function normalizeRpcUserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (item != null && typeof item === "object" && "user_id" in item) {
      const id = String((item as IdRow).user_id);
      if (id) out.push(id);
      continue;
    }
    if (typeof item === "string" && item) {
      out.push(item);
    }
  }
  return out;
}

function pickNonEmpty(a: string | null | undefined, b: string | null | undefined): string | null {
  const ta = a?.trim();
  if (ta) return ta;
  const tb = b?.trim();
  return tb || null;
}

function mergeIntegrationRows(
  keeperId: string,
  keeper: UserIntegrationSettingsRow | null,
  donor: UserIntegrationSettingsRow | null
): UserIntegrationSettingsRow | null {
  if (!donor && !keeper) return null;
  if (!donor) return keeper;
  if (!keeper) {
    return {
      ...donor,
      user_id: keeperId,
      updated_at: new Date().toISOString()
    };
  }

  return {
    user_id: keeperId,
    calendar_provider: keeper.calendar_provider || donor.calendar_provider,
    calendar_account_email: pickNonEmpty(keeper.calendar_account_email, donor.calendar_account_email),
    calendar_id: pickNonEmpty(keeper.calendar_id, donor.calendar_id),
    mail_provider: keeper.mail_provider || donor.mail_provider,
    mail_from_email: pickNonEmpty(keeper.mail_from_email, donor.mail_from_email),
    google_access_token: keeper.google_access_token || donor.google_access_token,
    google_refresh_token: keeper.google_refresh_token || donor.google_refresh_token,
    microsoft_access_token: keeper.microsoft_access_token || donor.microsoft_access_token,
    microsoft_refresh_token: keeper.microsoft_refresh_token || donor.microsoft_refresh_token,
    updated_at: new Date().toISOString(),
    created_at: keeper.created_at || donor.created_at
  };
}

/**
 * Sloučí aplikační data ze „sourozeneckých“ auth účtů se stejným e-mailem do právě přihlášeného uživatele.
 * Typicky po tom, co stejný člověk vytvořil účet přes Google i přes heslo (dva řádky v auth.users).
 */
export async function syncSiblingUserDataByEmail(params: {
  keeperUserId: string;
  email: string;
}): Promise<{ mergedPeers: number }> {
  const supabase = getSupabaseAdminClient();
  const normalized = params.email.trim().toLowerCase();
  if (!normalized) {
    return { mergedPeers: 0 };
  }

  const { data: idRows, error: rpcError } = await supabase.rpc("list_user_ids_for_email", {
    lookup_email: normalized
  });

  if (rpcError) {
    throw new Error(`list_user_ids_for_email: ${rpcError.message}`);
  }

  const peerIds = normalizeRpcUserIds(idRows).filter((id) => id !== params.keeperUserId);
  if (peerIds.length === 0) {
    return { mergedPeers: 0 };
  }

  const { data: keeperRow } = await supabase
    .from("user_integration_settings")
    .select("*")
    .eq("user_id", params.keeperUserId)
    .maybeSingle();

  let mergedSettings = (keeperRow ?? null) as UserIntegrationSettingsRow | null;

  for (const peerId of peerIds) {
    const { data: donorRow } = await supabase
      .from("user_integration_settings")
      .select("*")
      .eq("user_id", peerId)
      .maybeSingle();

    const donor = (donorRow ?? null) as UserIntegrationSettingsRow | null;
    mergedSettings = mergeIntegrationRows(params.keeperUserId, mergedSettings, donor);

    if (donor) {
      await supabase.from("user_integration_settings").delete().eq("user_id", peerId);
    }

    await supabase.from("conversations").update({ user_id: params.keeperUserId }).eq("user_id", peerId);

    await supabase.from("outbound_email_events").update({ user_id: params.keeperUserId }).eq("user_id", peerId);

    const peerText = peerId;
    await supabase.from("agent_trace_events").update({ user_id: params.keeperUserId }).eq("user_id", peerText);

    await supabase.from("agent_runs").update({ user_id: params.keeperUserId }).eq("user_id", peerText);

    await supabase.from("workflow_runs").update({ actor_user_id: params.keeperUserId }).eq("actor_user_id", peerText);
  }

  if (mergedSettings) {
    const { error: upsertError } = await supabase.from("user_integration_settings").upsert({
      user_id: mergedSettings.user_id,
      calendar_provider: mergedSettings.calendar_provider,
      calendar_account_email: mergedSettings.calendar_account_email,
      calendar_id: mergedSettings.calendar_id,
      mail_provider: mergedSettings.mail_provider,
      mail_from_email: mergedSettings.mail_from_email,
      google_access_token: mergedSettings.google_access_token,
      google_refresh_token: mergedSettings.google_refresh_token,
      microsoft_access_token: mergedSettings.microsoft_access_token,
      microsoft_refresh_token: mergedSettings.microsoft_refresh_token,
      updated_at: mergedSettings.updated_at,
      created_at: mergedSettings.created_at
    });

    if (upsertError) {
      throw new Error(`user_integration_settings upsert: ${upsertError.message}`);
    }
  }

  return { mergedPeers: peerIds.length };
}
