import { getGmailMessage } from "@/lib/agent/tools/email-tool";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ messageId: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { messageId } = await context.params;
    if (!messageId?.trim()) {
      return Response.json({ error: "Chybí messageId." }, { status: 400 });
    }
    const detail = await getGmailMessage({
      userId: user.id,
      messageId: messageId.trim(),
      maxBodyChars: 24_000
    });
    return Response.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer")
        ? 401
        : 400;
    return Response.json({ error: message }, { status });
  }
}
