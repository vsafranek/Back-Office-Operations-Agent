import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { parseListingFiltersFromUrl } from "@/lib/listings/filters";
import { searchListings } from "@/lib/listings/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser(request);
    const filters = parseListingFiltersFromUrl(new URL(request.url));
    const result = await searchListings(filters);

    return Response.json({
      items: result.items,
      pagination: {
        page: result.page,
        perPage: result.perPage,
        total: result.total,
        hasNextPage: result.hasNextPage
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Unauthorized") || message.includes("Bearer") ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}

export async function POST() {
  return Response.json(
    { error: "Legacy agent fetch flow was removed. Use GET /api/market-listings with query filters." },
    { status: 410 }
  );
}
