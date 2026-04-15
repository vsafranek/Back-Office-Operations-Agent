import { logger } from "@/lib/observability/logger";
import { fetchMapyMatrix, type MapyRouteType, type TransitCoordinate } from "@/lib/transit/mapy-matrix";

export const runtime = "nodejs";

const ALLOWED_ROUTE_TYPES: MapyRouteType[] = [
  "car_fast",
  "car_fast_traffic",
  "car_short",
  "foot_fast",
  "foot_hiking",
  "bike_road",
  "bike_mountain"
];

function createHttpError(status: number, message: string): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function parseBooleanParam(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseCoordinateList(url: URL, key: "starts" | "ends", required: boolean): TransitCoordinate[] {
  const rawEntries = url.searchParams.getAll(key);
  const chunks = rawEntries
    .flatMap((entry) => entry.split(";"))
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!chunks.length) {
    if (required) {
      throw createHttpError(400, `Missing required "${key}" query parameter.`);
    }
    return [];
  }

  return chunks.map((chunk, index) => {
    const parts = chunk.split(",").map((part) => part.trim());
    if (parts.length !== 2) {
      throw createHttpError(400, `Invalid ${key}[${index}] format. Use "longitude,latitude".`);
    }

    const longitude = Number(parts[0]);
    const latitude = Number(parts[1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw createHttpError(400, `Invalid ${key}[${index}] coordinates.`);
    }
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      throw createHttpError(400, `${key}[${index}] coordinates are outside valid range.`);
    }

    return { longitude, latitude };
  });
}

function parseRouteType(url: URL): MapyRouteType {
  const value = (url.searchParams.get("routeType") ?? "foot_fast").trim() as MapyRouteType;
  if (!ALLOWED_ROUTE_TYPES.includes(value)) {
    throw createHttpError(400, `Invalid routeType "${value}".`);
  }
  return value;
}

export async function GET(request: Request) {
  const correlationId = request.headers.get("x-correlation-id")?.trim() || crypto.randomUUID();

  try {
    const url = new URL(request.url);
    const starts = parseCoordinateList(url, "starts", true);
    const ends = parseCoordinateList(url, "ends", false);
    const routeType = parseRouteType(url);
    const avoidToll = parseBooleanParam(url.searchParams.get("avoidToll"));

    const endPoints = ends.length > 0 ? ends : starts;
    if (starts.length * endPoints.length > 100) {
      throw createHttpError(400, "Matrix request exceeds maximum of 100 start/end combinations.");
    }

    const matrix = await fetchMapyMatrix({
      starts,
      ends: ends.length > 0 ? ends : undefined,
      routeType,
      avoidToll
    });

    logger.info("transit_matrix_query", {
      correlationId,
      startsCount: starts.length,
      endsCount: endPoints.length,
      routeType
    });

    return Response.json(
      {
        routeType,
        starts,
        ends: endPoints,
        matrix: matrix.map((row) =>
          row.map((cell) => ({
            distanceM: cell.length,
            durationSec: cell.duration,
            durationMin: Math.max(1, Math.round(cell.duration / 60))
          }))
        )
      },
      { headers: { "x-correlation-id": correlationId } }
    );
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? ((error as { status: number }).status as number) : 502;
    const message = error instanceof Error ? error.message : "Unknown matrix routing error.";
    logger.warn("transit_matrix_query_failed", { correlationId, status, message });
    return Response.json({ error: message }, { status, headers: { "x-correlation-id": correlationId } });
  }
}
