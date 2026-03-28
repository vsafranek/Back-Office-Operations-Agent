import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { syncSiblingUserDataByEmail } from "@/lib/auth/sync-sibling-user-data";

export const runtime = "nodejs";

/**
 * Sloučí data (integrace, konverzace, audit) ze všech auth účtů se stejným e-mailem jako aktuální session,
 * do aktuálního uživatele. Idempotentní; vhodné zavolat po přihlášení.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const email = user.email?.trim().toLowerCase();
    if (!email) {
      return Response.json({ ok: true, mergedPeers: 0, skipped: "no_email" });
    }

    const { mergedPeers } = await syncSiblingUserDataByEmail({
      keeperUserId: user.id,
      email
    });

    return Response.json({ ok: true, mergedPeers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unauthorized") || message.includes("Bearer") || message.includes("Missing Bearer")
        ? 401
        : 500;
    return Response.json({ error: message }, { status });
  }
}
