import { pickLoginOAuthProviderForSession } from "@/lib/auth/login-oauth-provider-pick";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { persistGoogleOAuthTokens, persistMicrosoftOAuthTokens } from "@/lib/integrations/persist-user-integration";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  provider: z.enum(["google", "azure"]),
  accessToken: z.string().min(8),
  refreshToken: z.string().nullable().optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const bodyParsed = bodySchema.safeParse(await request.json());
    if (!bodyParsed.success) {
      return Response.json({ error: "Neplatná data požadavku." }, { status: 400 });
    }
    const body = bodyParsed.data;

    const admin = getSupabaseAdminClient();
    const { data: udata, error: uerr } = await admin.auth.admin.getUserById(user.id);
    if (uerr || !udata.user) {
      return Response.json({ error: "Nelze ověřit identitu uživatele." }, { status: 400 });
    }

    const expected = pickLoginOAuthProviderForSession(udata.user);
    if (expected !== body.provider) {
      return Response.json({ error: "Poskytovatel neodpovídá přihlášenému účtu." }, { status: 400 });
    }

    const profileEmail = udata.user.email ?? user.email ?? null;

    if (body.provider === "google") {
      await persistGoogleOAuthTokens({
        userId: user.id,
        accessToken: body.accessToken,
        refreshToken: body.refreshToken ?? null,
        profileEmail
      });
    } else {
      await persistMicrosoftOAuthTokens({
        userId: user.id,
        accessToken: body.accessToken,
        refreshToken: body.refreshToken ?? null,
        profileEmail
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer")
        ? 401
        : 400;
    return Response.json({ error: message }, { status });
  }
}
