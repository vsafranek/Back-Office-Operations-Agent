import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { decryptToken, encryptToken } from "@/lib/security/token-crypto";

const settingsSchema = z.object({
  calendar_provider: z.string().default("google"),
  calendar_account_email: z.string().email().optional().or(z.literal("")),
  calendar_id: z.string().optional().or(z.literal("")),
  mail_provider: z.string().default("gmail"),
  mail_from_email: z.string().email().optional().or(z.literal("")),
  google_refresh_token: z.string().optional().or(z.literal("")),
  google_access_token: z.string().optional().or(z.literal(""))
});

function toNullable(value: string | undefined) {
  if (!value || value.trim() === "") return null;
  return value.trim();
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("user_integration_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) return Response.json(null);

    return Response.json({
      ...data,
      google_access_token: "",
      google_refresh_token: "",
      has_google_tokens: Boolean(data.google_access_token || data.google_refresh_token)
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json();
    const parsed = settingsSchema.parse(body);

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("user_integration_settings").upsert({
      user_id: user.id,
      calendar_provider: parsed.calendar_provider,
      calendar_account_email: toNullable(parsed.calendar_account_email),
      calendar_id: toNullable(parsed.calendar_id),
      mail_provider: parsed.mail_provider,
      mail_from_email: toNullable(parsed.mail_from_email),
      google_refresh_token: encryptToken(toNullable(parsed.google_refresh_token)),
      google_access_token: encryptToken(toNullable(parsed.google_access_token)),
      updated_at: new Date().toISOString()
    });

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
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("user_integration_settings")
      .select("google_access_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const accessToken = decryptToken(data?.google_access_token ?? null);
    if (accessToken) {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `token=${encodeURIComponent(accessToken)}`
      });
    }

    const { error: updateError } = await supabase
      .from("user_integration_settings")
      .update({
        google_access_token: null,
        google_refresh_token: null,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
