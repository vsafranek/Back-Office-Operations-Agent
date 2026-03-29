import { getEnv } from "@/lib/config/env";
import { createOAuthState } from "@/lib/integrations/oauth-state";
import { googleOAuthIntegrationScopeString } from "@/lib/integrations/google-integration-scopes";
import { getOAuthPublicOrigin } from "@/lib/integrations/oauth-public-origin";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const env = getEnv();
    if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
      return Response.json({ error: "Google OAuth není nakonfigurováno (GOOGLE_OAUTH_CLIENT_ID / SECRET)." }, { status: 501 });
    }

    const origin = getOAuthPublicOrigin(request);
    const redirectUri = `${origin}/api/integrations/oauth/google/callback`;
    const state = createOAuthState("google", user.id);

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", env.GOOGLE_OAUTH_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", googleOAuthIntegrationScopeString());
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);

    return Response.json({ url: url.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer") ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
