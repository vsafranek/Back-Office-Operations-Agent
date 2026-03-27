import { z } from "zod";
import { runBackOfficeAgent } from "@/lib/agent";
import { listAgentIds } from "@/lib/agent/config/registry";
import type { AgentStreamLine } from "@/lib/agent/types";
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

function ndjsonLine(obj: AgentStreamLine): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser(request);
  } catch {
    return new Response(`${JSON.stringify({ type: "error", message: "Neautorizováno." })}\n`, {
      status: 401,
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" }
    });
  }

  let parsedBody: z.infer<typeof requestSchema>;
  try {
    const body = await request.json();
    parsedBody = requestSchema.parse(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid body";
    return new Response(JSON.stringify({ type: "error", message }) + "\n", {
      status: 400,
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" }
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: AgentStreamLine) => {
        controller.enqueue(ndjsonLine(obj));
      };
      try {
        const result = await runBackOfficeAgent({
          userId: user.id,
          question: parsedBody.question,
          conversationId: parsedBody.conversationId,
          agentId: parsedBody.agentId?.trim() || undefined,
          options: parsedBody.options,
          onProgress: async ({ phase }) => {
            send({ type: "phase", label: phase });
          },
          onOrchestratorDelta: (textChunk) => {
            send({ type: "orchestrator_delta", text: textChunk });
          }
        });
        send({ type: "result", payload: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive"
    }
  });
}
