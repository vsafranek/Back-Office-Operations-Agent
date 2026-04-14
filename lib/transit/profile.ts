import { computeTransitScore, estimateWalkMinutes, toScoreBand } from "@/lib/transit/scoring";

export type ListingTransitProfile = {
  listingId: string;
  nearestMetroStopId: string | null;
  nearestMetroStopName: string | null;
  nearestMetroLine: string | null;
  nearestMetroDistanceM: number | null;
  nearestMetroWalkMin: number | null;
  nearestTramDistanceM: number | null;
  nearestBusDistanceM: number | null;
  nearestTrainDistanceM: number | null;
  transitScore: number | null;
  transitScoreBand: "low" | "medium" | "high" | null;
};

export function normalizeTransitProfile(input: {
  listingId: string;
  nearestMetroStopId?: string | null;
  nearestMetroStopName?: string | null;
  nearestMetroLine?: string | null;
  nearestMetroDistanceM?: number | null;
  nearestTramDistanceM?: number | null;
  nearestBusDistanceM?: number | null;
  nearestTrainDistanceM?: number | null;
}): ListingTransitProfile {
  const nearestMetroDistanceM = input.nearestMetroDistanceM ?? null;
  const nearestTramDistanceM = input.nearestTramDistanceM ?? null;
  const nearestBusDistanceM = input.nearestBusDistanceM ?? null;
  const nearestTrainDistanceM = input.nearestTrainDistanceM ?? null;
  const transitScore = computeTransitScore({
    nearestMetroDistanceM,
    nearestTramDistanceM,
    nearestBusDistanceM,
    nearestTrainDistanceM
  });

  return {
    listingId: input.listingId,
    nearestMetroStopId: input.nearestMetroStopId ?? null,
    nearestMetroStopName: input.nearestMetroStopName ?? null,
    nearestMetroLine: input.nearestMetroLine ?? null,
    nearestMetroDistanceM,
    nearestMetroWalkMin: estimateWalkMinutes(nearestMetroDistanceM),
    nearestTramDistanceM,
    nearestBusDistanceM,
    nearestTrainDistanceM,
    transitScore,
    transitScoreBand: toScoreBand(transitScore)
  };
}
