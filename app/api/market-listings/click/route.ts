import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

const ClickPayloadSchema = z.object({
  listingId: z.string().uuid(),
  action: z.enum(["detail", "source"]),
  sourceUrl: z.string().url().optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json();
    const parsed = ClickPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "Neplatný payload kliknutí.", details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("listing_click_events").insert({
      listing_id: parsed.data.listingId,
      user_id: user.id,
      action: parsed.data.action,
      source_url: parsed.data.sourceUrl ?? null,
      metadata: {}
    });

    if (error) {
      return Response.json({ error: `Tracking insert failed: ${error.message}` }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Unauthorized") || message.includes("Bearer") ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
