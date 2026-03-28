import { getEnv } from "@/lib/config/env";
import { parseOAuthState } from "@/lib/integrations/oauth-state";
import { getOAuthPublicOrigin } from "@/lib/integrations/oauth-public-origin";
import { getMicrosoftOAuthScopes } from "@/lib/integrations/microsoft-user-auth";
import { persistMicrosoftOAuthTokens } from "@/lib/integrations/persist-user-integration";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const origin = getOAuthPublicOrigin(request);
  const settingsUrl = `${origin}/settings`;

  if (err) {
    const desc = url.searchParams.get("error_description") ?? err;
    return Response.redirect(`${settingsUrl}?oauth=error&provider=microsoft&reason=${encodeURIComponent(desc)}`);
  }

  if (!code || !state) {
    return Response.redirect(`${settingsUrl}?oauth=error&provider=microsoft&reason=missing_code`);
  }

  const payload = parseOAuthState(state);
  if (!payload || payload.provider !== "microsoft") {
    return Response.redirect(`${settingsUrl}?oauth=error&provider=microsoft&reason=invalid_state`);
  }

  try {
    const env = getEnv();
    if (!env.MICROSOFT_OAUTH_CLIENT_ID || !env.MICROSOFT_OAUTH_CLIENT_SECRET) {
      return Response.redirect(`${settingsUrl}?oauth=error&provider=microsoft&reason=not_configured`);
    }

    const tenant = env.MICROSOFT_OAUTH_TENANT ?? "common";
    const redirectUri = `${origin}/api/integrations/oauth/microsoft/callback`;
    const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.MICROSOFT_OAUTH_CLIENT_ID,
        client_secret: env.MICROSOFT_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: getMicrosoftOAuthScopes()
      }).toString()
    });

    const tokenJson = (await tokenRes.json()) as Record<string, unknown>;
    if (!tokenRes.ok) {
      const desc = typeof tokenJson.error_description === "string" ? tokenJson.error_description : JSON.stringify(tokenJson);
      return Response.redirect(`${settingsUrl}?oauth=error&provider=microsoft&reason=${encodeURIComponent(desc)}`);
    }

    const accessToken = typeof tokenJson.access_token === "string" ? tokenJson.access_token : null;
    const refreshToken = typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : null;
    if (!accessToken) {
      return Response.redirect(`${settingsUrl}?oauth=error&provider=microsoft&reason=no_access_token`);
    }

    let profileEmail: string | null = null;
    const me = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (me.ok) {
      const m = (await me.json()) as { mail?: string; userPrincipalName?: string };
      profileEmail = m.mail?.trim() || m.userPrincipalName?.trim() || null;
    }

    await persistMicrosoftOAuthTokens({
      userId: payload.userId,
      accessToken,
      refreshToken,
      profileEmail
    });

    return Response.redirect(`${settingsUrl}?oauth=ok&provider=microsoft`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return Response.redirect(`${settingsUrl}?oauth=error&provider=microsoft&reason=${encodeURIComponent(msg)}`);
  }
}
