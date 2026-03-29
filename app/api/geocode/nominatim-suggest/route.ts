import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getEnv } from "@/lib/config/env";
import { fetchNominatimCzPlaceSuggestions } from "@/lib/integrations/nominatim-suggest";

export const runtime = "nodejs";

/** Našeptávání adres v ČR (OSM Nominatim) pro panel Nabídky — pouze přihlášení uživatelé. */
export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser(request);
    const env = getEnv();
    if (env.MARKET_LISTINGS_DISABLE_NOMINATIM) {
      return Response.json({ suggestions: [] as { value: string; label: string }[] });
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q.length > 120) {
      return Response.json({ error: "Dotaz je příliš dlouhý." }, { status: 400 });
    }

    const ua =
      env.MARKET_FETCH_USER_AGENT?.trim() ||
      "BackOfficeBot/1.0 (+nominatim-suggest; respectful per https://operations.osmfoundation.org/policies/nominatim/)";

    const suggestions = await fetchNominatimCzPlaceSuggestions({
      q,
      userAgent: ua,
      timeoutMs: Math.min(12_000, env.AGENT_QUERY_TIMEOUT_MS),
      limit: 8
    });

    return Response.json({ suggestions });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
