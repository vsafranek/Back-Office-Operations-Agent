import { z } from "zod";
import { runBackOfficeAgent } from "@/lib/agent";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

const requestSchema = z.object({
  question: z.string().min(3),
  conversationId: z.string().uuid().optional(),
  options: z
    .object({
      presentation: z
        .object({
          slideCount: z.coerce.number().int().min(2).max(15).optional()
        })
        .optional()
    })
    .optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json();
    const parsed = requestSchema.parse(body);
    const result = await runBackOfficeAgent({
      userId: user.id,
      question: parsed.question,
      conversationId: parsed.conversationId,
      options: parsed.options
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 400 });
  }
}
