import { z } from "zod";
import { createUserCalendarEvent, listUserCalendarEvents } from "@/lib/agent/tools/calendar-tool";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";

export const runtime = "nodejs";

const querySchema = z.object({
  timeMin: z.string().min(10),
  timeMax: z.string().min(10)
});

const createSchema = z
  .object({
    title: z.string().trim().min(1, "Vyplňte název události."),
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    description: z.string().optional(),
    location: z.string().optional()
  })
  .refine((v) => new Date(v.end).getTime() > new Date(v.start).getTime(), {
    message: "Konec události musí být po začátku.",
    path: ["end"]
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

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Neplatný payload." }, { status: 400 });
    }
    const created = await createUserCalendarEvent({
      userId: user.id,
      input: parsed.data
    });
    return Response.json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer")
        ? 401
        : 400;
    return Response.json({ error: message }, { status });
  }
}
