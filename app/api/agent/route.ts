import { z } from "zod";
import { runBackOfficeAgent } from "@/lib/agent";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

const requestSchema = z.object({
  question: z.string().min(3),
  conversationId: z.string().uuid().optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json();
    const parsed = requestSchema.parse(body);
    const result = await runBackOfficeAgent({
      userId: user.id,
      question: parsed.question,
      conversationId: parsed.conversationId
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 400 });
  }
}
