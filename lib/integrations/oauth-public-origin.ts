import { getEnv } from "@/lib/config/env";

/**
 * Veřejná báze URL pro OAuth redirect_uri.
 * Pro požadavky z prohlížeče (stránka Nastavení) má přednost hlavička Origin — aby lokální vývoj
 * neomylem používal jen `NEXT_PUBLIC_APP_URL` z produkce (pak Google vrací redirect_uri_mismatch).
 */
export function getOAuthPublicOrigin(request: Request): string {
  const raw = request.headers.get("origin")?.trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).origin.replace(/\/$/, "");
    } catch {
      /* ignore */
    }
  }

  const env = getEnv();
  const fromEnv = env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return new URL(request.url).origin;
}
