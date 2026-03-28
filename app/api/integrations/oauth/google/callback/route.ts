import { getEnv } from "@/lib/config/env";
import { parseOAuthState } from "@/lib/integrations/oauth-state";
import { getOAuthPublicOrigin } from "@/lib/integrations/oauth-public-origin";
import { persistGoogleOAuthTokens } from "@/lib/integrations/persist-user-integration";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const origin = getOAuthPublicOrigin(request);
  const settingsUrl = `${origin}/settings`;

  if (err) {
    return Response.redirect(`${settingsUrl}?oauth=error&provider=google&reason=${encodeURIComponent(err)}`);
  }

  if (!code || !state) {
    return Response.redirect(`${settingsUrl}?oauth=error&provider=google&reason=missing_code`);
  }

  const payload = parseOAuthState(state);
  if (!payload || payload.provider !== "google") {
    return Response.redirect(`${settingsUrl}?oauth=error&provider=google&reason=invalid_state`);
  }

  try {
    const env = getEnv();
    if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
      return Response.redirect(`${settingsUrl}?oauth=error&provider=google&reason=not_configured`);
    }

    const redirectUri = `${origin}/api/integrations/oauth/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }).toString()
    });

    const tokenJson = (await tokenRes.json()) as Record<string, unknown>;
    if (!tokenRes.ok) {
      const desc = typeof tokenJson.error_description === "string" ? tokenJson.error_description : JSON.stringify(tokenJson);
      return Response.redirect(`${settingsUrl}?oauth=error&provider=google&reason=${encodeURIComponent(desc)}`);
    }

    const accessToken = typeof tokenJson.access_token === "string" ? tokenJson.access_token : null;
    const refreshToken = typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : null;
    if (!accessToken) {
      return Response.redirect(`${settingsUrl}?oauth=error&provider=google&reason=no_access_token`);
    }

    let profileEmail: string | null = null;
    const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (ui.ok) {
      const u = (await ui.json()) as { email?: string };
      profileEmail = u.email?.trim() || null;
    }

    await persistGoogleOAuthTokens({
      userId: payload.userId,
      accessToken,
      refreshToken,
      profileEmail
    });

    return Response.redirect(`${settingsUrl}?oauth=ok&provider=google`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return Response.redirect(`${settingsUrl}?oauth=error&provider=google&reason=${encodeURIComponent(msg)}`);
  }
}
