import { logger } from "@/lib/observability/logger";
import type { TransitMode, TransitRouteDto } from "@/lib/listings/types";
import { listActiveTransitStops } from "@/lib/transit/stops";

export const runtime = "nodejs";

const ALLOWED_MODES: TransitMode[] = ["metro", "tram", "bus", "train"];
const METRO_LINE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#facc15",
  C: "#ef4444",
  D: "#3b82f6"
};
const OSM_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const OSM_OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const FALLBACK_METRO_STOPS = [
  { id: "fallback-a-dejvicka", name: "Dejvicka", mode: "metro", metro_line: "A", latitude: 50.1009, longitude: 14.3946, is_active: true },
  { id: "fallback-a-mustek", name: "Mustek", mode: "metro", metro_line: "A", latitude: 50.0811, longitude: 14.4248, is_active: true },
  { id: "fallback-a-skalka", name: "Skalka", mode: "metro", metro_line: "A", latitude: 50.0687, longitude: 14.5072, is_active: true },
  { id: "fallback-b-zlicin", name: "Zlicin", mode: "metro", metro_line: "B", latitude: 50.0542, longitude: 14.291, is_active: true },
  { id: "fallback-b-mustek", name: "Mustek", mode: "metro", metro_line: "B", latitude: 50.0811, longitude: 14.4248, is_active: true },
  { id: "fallback-b-cerny-most", name: "Cerny Most", mode: "metro", metro_line: "B", latitude: 50.1092, longitude: 14.5778, is_active: true },
  { id: "fallback-c-letnany", name: "Letnany", mode: "metro", metro_line: "C", latitude: 50.1253, longitude: 14.5152, is_active: true },
  { id: "fallback-c-muzeum", name: "Muzeum", mode: "metro", metro_line: "C", latitude: 50.0797, longitude: 14.4313, is_active: true },
  { id: "fallback-c-haje", name: "Haje", mode: "metro", metro_line: "C", latitude: 50.0317, longitude: 14.5265, is_active: true }
] as const;

type OSMNodeElement = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

type OSMRelationMember = {
  type: "way" | "node" | "relation";
  ref: number;
  role: string;
  geometry?: Array<{ lat: number; lon: number }>;
};

type OSMRelationElement = {
  type: "relation";
  id: number;
  tags?: Record<string, string>;
  members?: OSMRelationMember[];
  geometry?: Array<{ lat: number; lon: number }>;
};

type OSMResponse = {
  elements: Array<OSMNodeElement | OSMRelationElement>;
};

let osmCache: {
  fetchedAt: number;
  stops: Array<{ id: string; name: string; mode: "metro"; metro_line: string | null; latitude: number; longitude: number; is_active: true }>;
  routes: TransitRouteDto[];
} | null = null;

type TransitStopRecord = {
  id: string;
  name: string;
  mode: TransitMode;
  metro_line: string | null;
  latitude: number;
  longitude: number;
  is_active: boolean;
};

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

function toMetroRoutes(stops: ReadonlyArray<{ metro_line: string | null; latitude: number; longitude: number }>): TransitRouteDto[] {
  const grouped = new Map<string, Array<{ latitude: number; longitude: number }>>();
  for (const stop of stops) {
    if (!stop.metro_line) continue;
    const current = grouped.get(stop.metro_line) ?? [];
    current.push({ latitude: stop.latitude, longitude: stop.longitude });
    grouped.set(stop.metro_line, current);
  }

  const routes: TransitRouteDto[] = [];
  for (const [line, points] of grouped.entries()) {
    if (points.length < 2) continue;

    const sortedPoints = [...points].sort((a, b) => {
      const latDiff = Math.abs(a.latitude - b.latitude);
      const lngDiff = Math.abs(a.longitude - b.longitude);
      if (latDiff >= lngDiff) return a.latitude - b.latitude;
      return a.longitude - b.longitude;
    });

    routes.push({
      id: `metro-${line}`,
      line,
      color: METRO_LINE_COLORS[line] ?? "#0ea5e9",
      points: sortedPoints
    });
  }

  return routes;
}

function normalizeMetroLine(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  if (["A", "B", "C", "D"].includes(trimmed)) return trimmed;
  const match = trimmed.match(/\b([ABCD])\b/);
  return match?.[1] ?? null;
}

function lineColor(line: string | null): string {
  if (!line) return "#2563eb";
  return METRO_LINE_COLORS[line] ?? "#2563eb";
}

function dedupeConsecutivePoints(points: Array<{ latitude: number; longitude: number }>): Array<{ latitude: number; longitude: number }> {
  if (points.length <= 1) return points;
  const deduped: Array<{ latitude: number; longitude: number }> = [];
  for (const point of points) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.latitude !== point.latitude || prev.longitude !== point.longitude) {
      deduped.push(point);
    }
  }
  return deduped;
}

function trimClosedLoop(points: Array<{ latitude: number; longitude: number }>): Array<{ latitude: number; longitude: number }> {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.abs(first.latitude - last.latitude) < 0.00015 && Math.abs(first.longitude - last.longitude) < 0.00015) {
    return points.slice(0, -1);
  }
  return points;
}

type OSMStationPoint = {
  nodeId: number;
  latitude: number;
  longitude: number;
};

function normalizeStationPath(points: OSMStationPoint[]): Array<{ latitude: number; longitude: number }> {
  if (points.length < 2) return points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));

  const noConsecutiveDupes: OSMStationPoint[] = [];
  for (const point of points) {
    const prev = noConsecutiveDupes[noConsecutiveDupes.length - 1];
    if (!prev || prev.nodeId !== point.nodeId) {
      noConsecutiveDupes.push(point);
    }
  }

  const firstSeen = new Set<number>();
  const uniquePath: OSMStationPoint[] = [];
  for (const point of noConsecutiveDupes) {
    if (firstSeen.has(point.nodeId)) continue;
    firstSeen.add(point.nodeId);
    uniquePath.push(point);
  }

  return trimClosedLoop(
    uniquePath.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude
    }))
  );
}

function mergeStopsForMap(params: {
  dbStops: TransitStopRecord[];
  metroStops: ReadonlyArray<{
    id: string;
    name: string;
    mode: "metro";
    metro_line: string | null;
    latitude: number;
    longitude: number;
    is_active: true;
  }>;
  metroLines?: string[];
}): TransitStopRecord[] {
  const normalizedMetroLines = params.metroLines?.map((line) => line.trim().toUpperCase()).filter(Boolean);
  const metroLineFilter = normalizedMetroLines && normalizedMetroLines.length > 0 ? new Set(normalizedMetroLines) : null;
  const filteredMetroStops = params.metroStops.filter((stop) => {
    if (!metroLineFilter) return true;
    if (!stop.metro_line) return false;
    return metroLineFilter.has(stop.metro_line.toUpperCase());
  });

  const nonMetroStops = params.dbStops.filter((stop) => stop.mode !== "metro");
  return [...nonMetroStops, ...filteredMetroStops];
}

async function fetchOsmPragueMetroData(): Promise<{
  stops: Array<{ id: string; name: string; mode: "metro"; metro_line: string | null; latitude: number; longitude: number; is_active: true }>;
  routes: TransitRouteDto[];
}> {
  const now = Date.now();
  if (osmCache && now - osmCache.fetchedAt < OSM_CACHE_TTL_MS) {
    return { stops: osmCache.stops, routes: osmCache.routes };
  }

  const query = [
    "[out:json][timeout:20];",
    "area[\"name\"=\"Praha\"][\"boundary\"=\"administrative\"]->.a;",
    "(",
    "  relation[\"route\"=\"subway\"](area.a);",
    "  node[\"railway\"=\"station\"][\"station\"=\"subway\"](area.a);",
    ");",
    "out body geom;"
  ].join("\n");

  const response = await fetch(OSM_OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query
  });

  if (!response.ok) {
    throw new Error(`OSM Overpass request failed (${response.status}).`);
  }

  const payload = (await response.json()) as OSMResponse;
  const nodeById = new Map<number, OSMNodeElement>(
    payload.elements
      .filter((element): element is OSMNodeElement => element.type === "node")
      .map((node) => [node.id, node])
  );
  const metroStopsByLineAndNode = new Map<
    string,
    { id: string; name: string; mode: "metro"; metro_line: string | null; latitude: number; longitude: number; is_active: true }
  >();

  const routes = payload.elements
    .filter((element): element is OSMRelationElement => element.type === "relation")
    .map((relation) => {
      const line = normalizeMetroLine(relation.tags?.ref ?? relation.tags?.name);
      const stationPoints =
        relation.members
          ?.filter(
            (member) =>
              member.type === "node" &&
              (member.role.includes("stop") || member.role.includes("platform") || member.role === "")
          )
          .map((member) => ({ member, node: nodeById.get(member.ref) }))
          .filter(
            (entry): entry is { member: OSMRelationMember; node: OSMNodeElement } =>
              Boolean(entry.node) && (entry.member.role.includes("stop") || entry.member.role === "")
          )
          .map((entry) => {
            const stopLine = line ?? normalizeMetroLine(entry.node.tags?.ref ?? entry.node.tags?.line);
            const stopKey = `${stopLine ?? "unknown"}:${entry.node.id}`;
            if (!metroStopsByLineAndNode.has(stopKey)) {
              metroStopsByLineAndNode.set(stopKey, {
                id: `osm-${entry.node.id}-${stopLine ?? "metro"}`,
                name: entry.node.tags?.name ?? `Metro ${entry.node.id}`,
                mode: "metro",
                metro_line: stopLine,
                latitude: entry.node.lat,
                longitude: entry.node.lon,
                is_active: true
              });
            }
            return entry.node;
          })
          .filter((node): node is OSMNodeElement => Boolean(node))
          .map((node) => ({ nodeId: node.id, latitude: node.lat, longitude: node.lon })) ?? [];
      const wayPoints =
        relation.members
          ?.filter((member) => member.type === "way" && Array.isArray(member.geometry))
          .flatMap((member) => member.geometry ?? [])
          .map((point) => ({ latitude: point.lat, longitude: point.lon })) ?? [];
      const points =
        stationPoints.length >= 2
          ? normalizeStationPath(stationPoints)
          : trimClosedLoop(dedupeConsecutivePoints(wayPoints));

      return {
        id: `osm-route-${relation.id}`,
        line: line ?? relation.tags?.name ?? `R${relation.id}`,
        color: lineColor(line),
        points
      } satisfies TransitRouteDto;
    })
    .filter((route) => route.points.length >= 2);

  const stops =
    metroStopsByLineAndNode.size > 0
      ? Array.from(metroStopsByLineAndNode.values())
      : payload.elements
          .filter((element): element is OSMNodeElement => element.type === "node")
          .map((node) => ({
            id: `osm-${node.id}`,
            name: node.tags?.name ?? `Metro ${node.id}`,
            mode: "metro" as const,
            metro_line: normalizeMetroLine(node.tags?.ref ?? node.tags?.line),
            latitude: node.lat,
            longitude: node.lon,
            is_active: true as const
          }));

  osmCache = {
    fetchedAt: now,
    stops,
    routes
  };
  return { stops, routes };
}

export async function GET(request: Request) {
  const correlationId = request.headers.get("x-correlation-id")?.trim() || crypto.randomUUID();

  try {
    const url = new URL(request.url);
    const bounds = parseBounds(url);
    const rawModes = parseCsvParam(url.searchParams.get("mode"));
    const modes = rawModes?.filter((mode): mode is TransitMode => ALLOWED_MODES.includes(mode as TransitMode));
    const metroLines = parseCsvParam(url.searchParams.get("metroLines"));
    const metroRequested = !modes || modes.includes("metro");

    const fetchedStops = (await listActiveTransitStops({
      modes: modes?.length ? modes : undefined,
      metroLines
    })) as TransitStopRecord[];
    let stopsForMap: TransitStopRecord[] = fetchedStops.length > 0 ? fetchedStops : ([...FALLBACK_METRO_STOPS] as TransitStopRecord[]);
    let routesForMap: TransitRouteDto[] = [];
    let osmRoutesUsed = false;
    let osmMetroStopsUsed = false;

    if (metroRequested) {
      try {
        const osmData = await fetchOsmPragueMetroData();
        if (osmData.stops.length > 0) {
          stopsForMap = mergeStopsForMap({
            dbStops: fetchedStops,
            metroStops: osmData.stops,
            metroLines
          });
          osmMetroStopsUsed = true;
        } else if (fetchedStops.length === 0) {
          stopsForMap = [...FALLBACK_METRO_STOPS] as TransitStopRecord[];
        }
        if (osmData.routes.length > 0) {
          routesForMap = osmData.routes;
          osmRoutesUsed = true;
        } else {
          routesForMap = toMetroRoutes(FALLBACK_METRO_STOPS);
        }
      } catch (osmError) {
        logger.warn("transit_stops_osm_fetch_failed", {
          correlationId,
          message: osmError instanceof Error ? osmError.message : "Unknown OSM fetch error"
        });
        if (fetchedStops.length === 0) {
          stopsForMap = [...FALLBACK_METRO_STOPS] as TransitStopRecord[];
        }
        routesForMap = toMetroRoutes(FALLBACK_METRO_STOPS);
      }
    }

    const items = bounds
      ? stopsForMap.filter(
          (stop) =>
            stop.latitude >= bounds.south &&
            stop.latitude <= bounds.north &&
            stop.longitude >= bounds.west &&
            stop.longitude <= bounds.east
        )
      : stopsForMap;

    logger.info("transit_stops_query", {
      correlationId,
      count: items.length,
      routeCount: routesForMap.length,
      osmRoutesUsed,
      osmMetroStopsUsed,
      fallbackUsed: fetchedStops.length === 0,
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
      })),
      routes: routesForMap
    }, { headers: { "x-correlation-id": correlationId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.warn("transit_stops_query_failed", { correlationId, message });
    return Response.json({ error: message }, { status: 400, headers: { "x-correlation-id": correlationId } });
  }
}
