import { getEnv } from "@/lib/config/env";
import { createOAuthState } from "@/lib/integrations/oauth-state";
import { getOAuthPublicOrigin } from "@/lib/integrations/oauth-public-origin";
import { getMicrosoftOAuthScopes } from "@/lib/integrations/microsoft-user-auth";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const env = getEnv();
    if (!env.MICROSOFT_OAUTH_CLIENT_ID || !env.MICROSOFT_OAUTH_CLIENT_SECRET) {
      return Response.json(
        { error: "Microsoft OAuth není nakonfigurováno (MICROSOFT_OAUTH_CLIENT_ID / SECRET)." },
        { status: 501 }
      );
    }

    const origin = getOAuthPublicOrigin(request);
    const redirectUri = `${origin}/api/integrations/oauth/microsoft/callback`;
    const state = createOAuthState("microsoft", user.id);
    const tenant = env.MICROSOFT_OAUTH_TENANT ?? "common";

    const url = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
    url.searchParams.set("client_id", env.MICROSOFT_OAUTH_CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", getMicrosoftOAuthScopes());
    url.searchParams.set("state", state);

    return Response.json({ url: url.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer") ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
