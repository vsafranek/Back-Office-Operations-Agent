import { getAuthenticatedUserFromRequest } from "@/lib/auth/server-auth";
import { parseListingFiltersFromUrl } from "@/lib/listings/filters";
import { searchListings } from "@/lib/listings/queries";
import { listSavedListings } from "@/lib/listings/saved-listings";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

function getCorrelationId(request: Request): string {
  return request.headers.get("x-correlation-id")?.trim() || crypto.randomUUID();
}

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const filters = parseListingFiltersFromUrl(new URL(request.url));
    const result = await searchListings(filters);

    let savedIds = new Set<string>();
    if (user) {
      const saved = await listSavedListings(user.id);
      savedIds = new Set(saved.map((item) => item.listingId));
    }

    const items = result.items.map((item) => ({
      ...item,
      isSaved: user ? savedIds.has(item.id) : false
    }));

    logger.info("market_listings_query", {
      correlationId,
      userId: user?.id ?? null,
      hasBounds: Boolean(filters.bounds),
      nearMetro: Boolean(filters.nearMetro),
      maxMetroDistanceM: filters.maxMetroDistanceM ?? null,
      maxMetroWalkMin: filters.maxMetroWalkMin ?? null,
      minTransitScore: filters.minTransitScore ?? null,
      transitModes: filters.transitModes ?? [],
      transitMatchMode: filters.transitMatchMode,
      count: items.length,
      total: result.total
    });

    return Response.json({
      items,
      pagination: {
        page: result.page,
        perPage: result.perPage,
        total: result.total,
        hasNextPage: result.hasNextPage
      },
      map: {
        bounds: result.mapBounds,
        totalInBounds: result.totalInBounds
      }
    }, { headers: { "x-correlation-id": correlationId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.warn("market_listings_query_failed", { correlationId, message });
    return Response.json({ error: message }, { status: 400, headers: { "x-correlation-id": correlationId } });
  }
}

export async function POST() {
  return Response.json(
    { error: "Legacy agent fetch flow was removed. Use GET /api/market-listings with query filters." },
    { status: 410 }
  );
}
