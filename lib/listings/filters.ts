import { z } from "zod";

import type { TransitMode } from "@/lib/listings/types";

const toInt = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalInt = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toOptionalNumber = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const splitCsv = (value: string | null): string[] | undefined => {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
};

const TransitModeSchema = z.enum(["metro", "tram", "bus", "train"]);

const toBoolean = (value: string | null): boolean | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
};

const BoundsSchema = z
  .object({
    north: z.number().min(-90).max(90),
    south: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
    west: z.number().min(-180).max(180)
  })
  .refine((value) => value.north > value.south, {
    message: "north must be greater than south",
    path: ["north"]
  })
  .refine((value) => value.east !== value.west, {
    message: "east and west cannot be equal",
    path: ["east"]
  });

export const ListingFilterSchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(24),
  sourceKeys: z.array(z.string().min(1)).optional(),
  offerTypes: z.array(z.string().min(1)).optional(),
  propertyTypes: z.array(z.string().min(1)).optional(),
  dispositions: z.array(z.string().min(1)).optional(),
  localityQuery: z.string().trim().min(1).max(120).optional(),
  region: z.string().trim().min(1).max(120).optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  minFloorArea: z.number().min(0).optional(),
  maxFloorArea: z.number().min(0).optional(),
  minLandArea: z.number().min(0).optional(),
  maxLandArea: z.number().min(0).optional(),
  sort: z.enum(["last_seen_desc", "price_asc", "price_desc", "area_desc", "area_asc"]).default("last_seen_desc"),
  includeInactive: z.boolean().default(false),
  bounds: BoundsSchema.optional(),
  nearMetro: z.boolean().optional(),
  maxMetroDistanceM: z.number().int().min(100).max(5000).optional(),
  maxMetroWalkMin: z.number().int().min(1).max(60).optional(),
  minTransitScore: z.number().int().min(0).max(100).optional(),
  metroLines: z.array(z.string().trim().min(1)).optional(),
  metroStopIds: z.array(z.string().uuid()).optional(),
  transitModes: z.array(TransitModeSchema).optional(),
  transitMatchMode: z.enum(["any", "all"]).default("any")
});

export type ListingFilters = z.infer<typeof ListingFilterSchema>;
export type ListingTransitMatchMode = ListingFilters["transitMatchMode"];
export type ListingTransitModeFilter = TransitMode;

export function parseListingFiltersFromUrl(url: URL): ListingFilters {
  const p = url.searchParams;

  const north = toOptionalNumber(p.get("north"));
  const south = toOptionalNumber(p.get("south"));
  const east = toOptionalNumber(p.get("east"));
  const west = toOptionalNumber(p.get("west"));

  const parsed = ListingFilterSchema.safeParse({
    page: toInt(p.get("page"), 1),
    perPage: toInt(p.get("perPage") ?? p.get("limit"), 24),
    sourceKeys: splitCsv(p.get("source")),
    offerTypes: splitCsv(p.get("offerType")),
    propertyTypes: splitCsv(p.get("propertyType")),
    dispositions: splitCsv(p.get("disposition")),
    localityQuery: p.get("q") ?? undefined,
    region: p.get("region") ?? undefined,
    minPrice: toOptionalInt(p.get("minPrice") ?? p.get("priceMin")),
    maxPrice: toOptionalInt(p.get("maxPrice") ?? p.get("priceMax")),
    minFloorArea: toOptionalNumber(p.get("minFloorArea") ?? p.get("areaMin")),
    maxFloorArea: toOptionalNumber(p.get("maxFloorArea") ?? p.get("areaMax")),
    minLandArea: toOptionalNumber(p.get("minLandArea")),
    maxLandArea: toOptionalNumber(p.get("maxLandArea")),
    sort: p.get("sort") ?? "last_seen_desc",
    includeInactive: ["1", "true", "yes", "on"].includes((p.get("includeInactive") ?? "").toLowerCase()),
    nearMetro: toBoolean(p.get("nearMetro")),
    maxMetroDistanceM: toOptionalInt(p.get("maxMetroDistanceM")),
    maxMetroWalkMin: toOptionalInt(p.get("maxMetroWalkMin")),
    minTransitScore: toOptionalInt(p.get("minTransitScore")),
    metroLines: splitCsv(p.get("metroLines")),
    metroStopIds: splitCsv(p.get("metroStopIds")),
    transitModes: splitCsv(p.get("transitModes")) as TransitMode[] | undefined,
    transitMatchMode: p.get("transitMatchMode") ?? "any",
    bounds:
      north != null && south != null && east != null && west != null
        ? {
            north,
            south,
            east,
            west
          }
        : undefined
  });

  if (!parsed.success) {
    throw new Error(`Invalid listing filters: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  }

  return parsed.data;
}
