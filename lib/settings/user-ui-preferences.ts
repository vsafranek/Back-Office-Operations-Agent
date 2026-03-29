import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Výchozí true. Pro ne-UUID userId (cron, test) vždy true.
 */
export async function getPresentationOpeningTitleSlideForUser(userId: string): Promise<boolean> {
  if (!UUID_RE.test(userId)) return true;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_ui_preferences")
    .select("presentation_opening_slide")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return true;
  return data.presentation_opening_slide !== false;
}
