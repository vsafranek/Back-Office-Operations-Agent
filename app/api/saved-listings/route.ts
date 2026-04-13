import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { listSavedListings, saveListingForUser } from "@/lib/listings/saved-listings";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

const SaveSchema = z.object({
  listingId: z.string().uuid()
});

export async function GET(request: Request) {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  try {
    const user = await requireAuthenticatedUser(request);
    const items = await listSavedListings(user.id);

    logger.info("saved_listings_list", {
      correlationId,
      userId: user.id,
      count: items.length
    });

    return Response.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json();
    const parsed = SaveSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const item = await saveListingForUser(user.id, parsed.data.listingId);

    logger.info("saved_listing_added", {
      correlationId,
      userId: user.id,
      listingId: parsed.data.listingId
    });

    return Response.json(item, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Listing not found")) {
      return Response.json({ error: message }, { status: 404 });
    }
    const status = message.includes("Unauthorized") ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
