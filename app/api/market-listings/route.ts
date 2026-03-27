import { FetchMarketListingsInputSchema, fetchMarketListings } from "@/lib/agent/tools/market-listings-tool";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

/**
 * Klient (AgentDataPanel) tímto dotáhne nabídky podle parametrů z úvahy agenta.
 */
export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser(request);
    const body: unknown = await request.json();
    const parsed = FetchMarketListingsInputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Neplatné parametry.", details: parsed.error.flatten() }, { status: 400 });
    }
    const listings = await fetchMarketListings(parsed.data);
    return Response.json({ listings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Unauthorized") || message.includes("Bearer") ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
