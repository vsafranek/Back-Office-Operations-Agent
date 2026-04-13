import { getAuthenticatedUserFromRequest } from "@/lib/auth/server-auth";
import { getListingDetailById } from "@/lib/listings/queries";
import { listSavedListings } from "@/lib/listings/saved-listings";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const params = await context.params;

    const detail = await getListingDetailById(params.id);
    if (!detail) {
      return Response.json({ error: "Inzerát nebyl nalezen." }, { status: 404 });
    }

    const isSaved = user
      ? (await listSavedListings(user.id)).some((saved) => saved.listingId === detail.id)
      : false;

    return Response.json({ item: { ...detail, isSaved } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 400 });
  }
}
