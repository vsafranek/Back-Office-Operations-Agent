export type TransitCoordinate = {
  longitude: number;
  latitude: number;
};

export type MapyRouteType =
  | "car_fast"
  | "car_fast_traffic"
  | "car_short"
  | "foot_fast"
  | "foot_hiking"
  | "bike_road"
  | "bike_mountain";

export type MatrixResultCell = {
  length: number;
  duration: number;
};

const MAPY_MATRIX_URL = "https://api.mapy.cz/v1/routing/matrix-m";
const MATRIX_MAX_COMBINATIONS = 100;

function serializeCoordinates(points: TransitCoordinate[]): string {
  return points.map((point) => `${point.longitude},${point.latitude}`).join(";");
}

function resolveMapyApiKey(): string {
  const key = process.env.MAPY_API_KEY?.trim() || process.env.NEXT_PUBLIC_MAPY_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing Mapy API key. Configure MAPY_API_KEY or NEXT_PUBLIC_MAPY_API_KEY.");
  }
  return key;
}

function assertValidPoint(point: TransitCoordinate, label: string): void {
  if (!Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90) {
    throw new Error(`${label}: invalid latitude.`);
  }
  if (!Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) {
    throw new Error(`${label}: invalid longitude.`);
  }
}

function assertWithinCombinationLimit(startsCount: number, endsCount: number): void {
  if (startsCount * endsCount > MATRIX_MAX_COMBINATIONS) {
    throw new Error(`Matrix limit exceeded (${startsCount}x${endsCount} > ${MATRIX_MAX_COMBINATIONS}).`);
  }
}

export async function fetchMapyMatrix(params: {
  starts: TransitCoordinate[];
  ends?: TransitCoordinate[];
  routeType: MapyRouteType;
  avoidToll?: boolean;
  signal?: AbortSignal;
}): Promise<MatrixResultCell[][]> {
  if (!params.starts.length) {
    throw new Error("Matrix routing requires at least one start point.");
  }
  params.starts.forEach((point, idx) => assertValidPoint(point, `starts[${idx}]`));

  const ends = params.ends?.length ? params.ends : params.starts;
  ends.forEach((point, idx) => assertValidPoint(point, `ends[${idx}]`));
  assertWithinCombinationLimit(params.starts.length, ends.length);

  const apiKey = resolveMapyApiKey();
  const url = new URL(MAPY_MATRIX_URL);
  url.searchParams.set("starts", serializeCoordinates(params.starts));
  if (params.ends?.length) {
    url.searchParams.set("ends", serializeCoordinates(params.ends));
  }
  url.searchParams.set("routeType", params.routeType);
  if (params.avoidToll) {
    url.searchParams.set("avoidToll", "true");
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    signal: params.signal,
    headers: {
      Accept: "application/json",
      "X-Mapy-Api-Key": apiKey
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Mapy matrix request failed (${response.status})${body ? `: ${body}` : "."}`);
  }

  const payload = (await response.json()) as { matrix?: unknown };
  if (!Array.isArray(payload.matrix)) {
    throw new Error("Mapy matrix response does not contain a valid matrix.");
  }

  const matrix = payload.matrix.map((row) => {
    if (!Array.isArray(row)) {
      throw new Error("Mapy matrix response contains an invalid row.");
    }
    return row.map((cell) => {
      const value = cell as { length?: unknown; duration?: unknown };
      if (typeof value.length !== "number" || typeof value.duration !== "number") {
        throw new Error("Mapy matrix response contains an invalid cell.");
      }
      return { length: value.length, duration: value.duration };
    });
  });

  return matrix;
}
