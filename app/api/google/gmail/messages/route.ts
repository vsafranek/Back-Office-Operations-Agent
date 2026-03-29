import { z } from "zod";
import { listGmailMessages } from "@/lib/agent/tools/email-tool";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

const querySchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(50).optional(),
  q: z.string().max(500).optional()
});

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      maxResults: url.searchParams.get("maxResults") ?? undefined,
      q: url.searchParams.get("q") ?? undefined
    });
    if (!parsed.success) {
      return Response.json({ error: "Neplatné parametry." }, { status: 400 });
    }
    const data = await listGmailMessages({
      userId: user.id,
      maxResults: parsed.data.maxResults,
      q: parsed.data.q
    });
    return Response.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer")
        ? 401
        : 400;
    return Response.json({ error: message }, { status });
  }
}
