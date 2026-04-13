import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { unsaveListingForUser } from "@/lib/listings/saved-listings";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ listingId: string }> }) {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  try {
    const user = await requireAuthenticatedUser(request);
    const { listingId } = await context.params;

    const removed = await unsaveListingForUser(user.id, listingId);
    if (!removed) {
      return Response.json({ error: "Saved listing not found." }, { status: 404 });
    }

    logger.info("saved_listing_removed", {
      correlationId,
      userId: user.id,
      listingId
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Unauthorized") ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
