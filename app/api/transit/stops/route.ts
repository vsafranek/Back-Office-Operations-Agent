import { logger } from "@/lib/observability/logger";
import type { TransitMode } from "@/lib/listings/types";
import { listActiveTransitStops } from "@/lib/transit/stops";

export const runtime = "nodejs";

const ALLOWED_MODES: TransitMode[] = ["metro", "tram", "bus", "train"];

function parseNumberParam(value: string | null, name: string): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name} value.`);
  }
  return parsed;
}

function parseBounds(url: URL): { north: number; south: number; east: number; west: number } | null {
  const north = parseNumberParam(url.searchParams.get("north"), "north");
  const south = parseNumberParam(url.searchParams.get("south"), "south");
  const east = parseNumberParam(url.searchParams.get("east"), "east");
  const west = parseNumberParam(url.searchParams.get("west"), "west");

  if (north == null && south == null && east == null && west == null) {
    return null;
  }
  if (north == null || south == null || east == null || west == null) {
    throw new Error("Bounds must include north, south, east and west.");
  }
  if (north <= south) {
    throw new Error("north must be greater than south.");
  }
  if (east === west) {
    throw new Error("east and west cannot be equal.");
  }
  if (north < -90 || north > 90 || south < -90 || south > 90 || east < -180 || east > 180 || west < -180 || west > 180) {
    throw new Error("Bounds are outside valid coordinate range.");
  }

  return { north, south, east, west };
}

function parseCsvParam(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export async function GET(request: Request) {
  const correlationId = request.headers.get("x-correlation-id")?.trim() || crypto.randomUUID();

  try {
    const url = new URL(request.url);
    const bounds = parseBounds(url);
    const rawModes = parseCsvParam(url.searchParams.get("mode"));
    const modes = rawModes?.filter((mode): mode is TransitMode => ALLOWED_MODES.includes(mode as TransitMode));
    const metroLines = parseCsvParam(url.searchParams.get("metroLines"));

    const allStops = await listActiveTransitStops({
      modes: modes?.length ? modes : undefined,
      metroLines
    });

    const items = bounds
      ? allStops.filter(
          (stop) =>
            stop.latitude >= bounds.south &&
            stop.latitude <= bounds.north &&
            stop.longitude >= bounds.west &&
            stop.longitude <= bounds.east
        )
      : allStops;

    logger.info("transit_stops_query", {
      correlationId,
      count: items.length,
      modeCount: modes?.length ?? 0,
      hasBounds: Boolean(bounds)
    });

    return Response.json({
      items: items.map((stop) => ({
        id: stop.id,
        name: stop.name,
        mode: stop.mode,
        metroLine: stop.metro_line,
        latitude: stop.latitude,
        longitude: stop.longitude
      }))
    }, { headers: { "x-correlation-id": correlationId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.warn("transit_stops_query_failed", { correlationId, message });
    return Response.json({ error: message }, { status: 400, headers: { "x-correlation-id": correlationId } });
  }
}
