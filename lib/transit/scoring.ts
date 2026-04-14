import type { TransitMode } from "@/lib/listings/types";

const WALK_METERS_PER_MINUTE = 78;

export function estimateWalkMinutes(distanceMeters: number | null | undefined): number | null {
  if (distanceMeters == null || !Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
  return Math.max(1, Math.round(distanceMeters / WALK_METERS_PER_MINUTE));
}

export function computeTransitScore(input: {
  nearestMetroDistanceM?: number | null;
  nearestTramDistanceM?: number | null;
  nearestBusDistanceM?: number | null;
  nearestTrainDistanceM?: number | null;
}): number {
  const metro = input.nearestMetroDistanceM ?? 5000;
  const tram = input.nearestTramDistanceM ?? 5000;
  const bus = input.nearestBusDistanceM ?? 5000;
  const train = input.nearestTrainDistanceM ?? 5000;

  const metroScore = Math.max(0, 55 - metro / 30);
  const tramScore = Math.max(0, 20 - tram / 80);
  const busScore = Math.max(0, 15 - bus / 120);
  const trainScore = Math.max(0, 10 - train / 200);

  return Math.max(0, Math.min(100, Math.round(metroScore + tramScore + busScore + trainScore)));
}

export function toScoreBand(score: number | null | undefined): "low" | "medium" | "high" | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function modeDistanceField(mode: TransitMode): "nearestMetroDistanceM" | "nearestTramDistanceM" | "nearestBusDistanceM" | "nearestTrainDistanceM" {
  switch (mode) {
    case "metro":
      return "nearestMetroDistanceM";
    case "tram":
      return "nearestTramDistanceM";
    case "bus":
      return "nearestBusDistanceM";
    case "train":
      return "nearestTrainDistanceM";
  }
}
