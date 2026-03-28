import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getEnv } from "@/lib/config/env";

export type OAuthConnectProvider = "google" | "microsoft";

export type OAuthStatePayload = {
  userId: string;
  provider: OAuthConnectProvider;
  nonce: string;
  exp: number;
};

export function createOAuthState(provider: OAuthConnectProvider, userId: string): string {
  const exp = Date.now() + 15 * 60 * 1000;
  const nonce = randomBytes(16).toString("hex");
  const body = JSON.stringify({ userId, provider, nonce, exp } satisfies OAuthStatePayload);
  const env = getEnv();
  const sig = createHmac("sha256", env.TOKEN_ENCRYPTION_KEY).update(body).digest("base64url");
  return Buffer.from(JSON.stringify({ body, sig }), "utf8").toString("base64url");
}

export function parseOAuthState(token: string): OAuthStatePayload | null {
  try {
    const wrapper = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as { body: string; sig: string };
    const env = getEnv();
    const expected = createHmac("sha256", env.TOKEN_ENCRYPTION_KEY).update(wrapper.body).digest("base64url");
    const a = Buffer.from(wrapper.sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(wrapper.body) as OAuthStatePayload;
    if (Date.now() > payload.exp) return null;
    if (!payload.userId || !payload.provider || !payload.nonce) return null;
    return payload;
  } catch {
    return null;
  }
}
