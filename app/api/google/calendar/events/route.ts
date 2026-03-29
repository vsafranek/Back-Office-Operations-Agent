import { z } from "zod";
import { listUserCalendarEvents } from "@/lib/agent/tools/calendar-tool";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

const querySchema = z.object({
  timeMin: z.string().min(10),
  timeMax: z.string().min(10)
});

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      timeMin: url.searchParams.get("timeMin") ?? "",
      timeMax: url.searchParams.get("timeMax") ?? ""
    });
    if (!parsed.success) {
      return Response.json({ error: "Zadejte timeMin a timeMax (ISO)." }, { status: 400 });
    }
    const data = await listUserCalendarEvents({
      userId: user.id,
      timeMin: parsed.data.timeMin,
      timeMax: parsed.data.timeMax
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
