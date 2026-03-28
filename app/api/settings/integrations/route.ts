import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { decryptToken } from "@/lib/security/token-crypto";
import { fetchUserIntegrationSettings } from "@/lib/integrations/user-integration-settings";
import { clearGoogleIntegrationTokens, clearMicrosoftIntegrationTokens } from "@/lib/integrations/persist-user-integration";

const patchSchema = z.object({
  calendar_provider: z.enum(["google", "microsoft"]).optional(),
  calendar_account_email: z.string().email().optional().or(z.literal("")),
  calendar_id: z.string().optional().or(z.literal("")),
  mail_provider: z.enum(["gmail", "outlook"]).optional(),
  mail_from_email: z.string().email().optional().or(z.literal(""))
});

function toNullable(value: string | undefined) {
  if (!value || value.trim() === "") return null;
  return value.trim();
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const row = await fetchUserIntegrationSettings(user.id);

    if (!row) return Response.json(null);

    return Response.json({
      ...row,
      google_access_token: "",
      google_refresh_token: "",
      microsoft_access_token: "",
      microsoft_refresh_token: "",
      has_google_tokens: Boolean(row.google_access_token || row.google_refresh_token),
      has_microsoft_tokens: Boolean(row.microsoft_access_token || row.microsoft_refresh_token)
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json();
    const parsed = patchSchema.parse(body);

    const existing = await fetchUserIntegrationSettings(user.id);
    const supabase = getSupabaseAdminClient();

    const nextRow = {
      user_id: user.id,
      calendar_provider: parsed.calendar_provider ?? existing?.calendar_provider ?? "google",
      calendar_account_email:
        parsed.calendar_account_email !== undefined
          ? toNullable(parsed.calendar_account_email)
          : (existing?.calendar_account_email ?? null),
      calendar_id: parsed.calendar_id !== undefined ? toNullable(parsed.calendar_id) : (existing?.calendar_id ?? null),
      mail_provider: parsed.mail_provider ?? existing?.mail_provider ?? "gmail",
      mail_from_email:
        parsed.mail_from_email !== undefined ? toNullable(parsed.mail_from_email) : (existing?.mail_from_email ?? null),
      google_access_token: existing?.google_access_token ?? null,
      google_refresh_token: existing?.google_refresh_token ?? null,
      microsoft_access_token: existing?.microsoft_access_token ?? null,
      microsoft_refresh_token: existing?.microsoft_refresh_token ?? null,
      updated_at: new Date().toISOString(),
      created_at: existing?.created_at ?? new Date().toISOString()
    };

    const { error } = await supabase.from("user_integration_settings").upsert(nextRow);

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider") ?? "google";

    if (provider === "google") {
      const existing = await fetchUserIntegrationSettings(user.id);
      const supabase = getSupabaseAdminClient();
      const accessToken = decryptToken(existing?.google_access_token ?? null);
      if (accessToken) {
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `token=${encodeURIComponent(accessToken)}`
        });
      }
      await clearGoogleIntegrationTokens(user.id);
      return Response.json({ ok: true });
    }

    if (provider === "microsoft") {
      await clearMicrosoftIntegrationTokens(user.id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Neplatný provider (google | microsoft)." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
