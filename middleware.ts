import { NextResponse, type NextRequest } from "next/server";

function isPortalModeOnly(): boolean {
  const raw = process.env.PORTAL_MODE_ONLY ?? process.env.NEXT_PUBLIC_PORTAL_MODE_ONLY ?? "";
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

const blockedApiPrefixes = [
  "/api/agent",
  "/api/audit",
  "/api/conversations",
  "/api/cron",
  "/api/data",
  "/api/geocode",
  "/api/google",
  "/api/integrations",
  "/api/mail",
  "/api/settings",
  "/api/storage",
  "/api/workflows"
];

const blockedPagePrefixes = ["/dashboard", "/settings", "/storage"];

const allowedApiPrefixes = ["/api/market-listings", "/api/integrations/sreality/ingest"];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  if (!isPortalModeOnly()) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (startsWithAny(pathname, allowedApiPrefixes)) {
      return NextResponse.next();
    }

    if (startsWithAny(pathname, blockedApiPrefixes)) {
      return NextResponse.json(
        { error: "This endpoint is disabled in portal-only mode.", code: "PORTAL_MODE_ONLY" },
        { status: 410 }
      );
    }
  }

  if (startsWithAny(pathname, blockedPagePrefixes)) {
    const target = request.nextUrl.clone();
    target.pathname = "/";
    target.searchParams.set("mode", "portal");
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"]
};
