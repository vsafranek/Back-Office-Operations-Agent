import { getEnv } from "@/lib/config/env";

export function getOAuthPublicOrigin(request: Request): string {
  const env = getEnv();
  const fromEnv = env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return new URL(request.url).origin;
}
