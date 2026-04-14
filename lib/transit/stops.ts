import type { TransitMode } from "@/lib/listings/types";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export type TransitStopRecord = {
  id: string;
  name: string;
  mode: TransitMode;
  metro_line: string | null;
  latitude: number;
  longitude: number;
  is_active: boolean;
};

export async function listActiveTransitStops(params?: {
  modes?: TransitMode[];
  metroLines?: string[];
}): Promise<TransitStopRecord[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("transit_stops")
    .select("id,name,mode,metro_line,latitude,longitude,is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (params?.modes?.length) {
    query = query.in("mode", params.modes);
  }
  if (params?.metroLines?.length) {
    query = query.in("metro_line", params.metroLines);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list transit stops: ${error.message}`);
  }

  return (data ?? []) as TransitStopRecord[];
}
