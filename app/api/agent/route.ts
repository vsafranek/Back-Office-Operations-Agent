import { z } from "zod";
import { runBackOfficeAgent } from "@/lib/agent";
import { listAgentIds } from "@/lib/agent/config/registry";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

const agentIdSchema = z
  .string()
  .optional()
  .refine((id) => id == null || id === "" || listAgentIds().includes(id), {
    message: "Unknown agentId"
  });

const requestSchema = z.object({
  question: z.string().min(3),
  conversationId: z.string().uuid().optional(),
  agentId: agentIdSchema,
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
      agentId: parsed.agentId?.trim() || undefined,
      options: parsed.options
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 400 });
  }
}
