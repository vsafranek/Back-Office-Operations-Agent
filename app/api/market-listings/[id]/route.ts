import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getListingDetailById } from "@/lib/listings/queries";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser(request);
    const params = await context.params;

    const detail = await getListingDetailById(params.id);
    if (!detail) {
      return Response.json({ error: "Inzerát nebyl nalezen." }, { status: 404 });
    }

    return Response.json({ item: detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Unauthorized") || message.includes("Bearer") ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
