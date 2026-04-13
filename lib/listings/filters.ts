import { z } from "zod";

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
  includeInactive: z.boolean().default(false)
});

export type ListingFilters = z.infer<typeof ListingFilterSchema>;

export function parseListingFiltersFromUrl(url: URL): ListingFilters {
  const p = url.searchParams;

  const parsed = ListingFilterSchema.safeParse({
    page: toInt(p.get("page"), 1),
    perPage: toInt(p.get("perPage"), 24),
    sourceKeys: splitCsv(p.get("source")),
    offerTypes: splitCsv(p.get("offerType")),
    propertyTypes: splitCsv(p.get("propertyType")),
    dispositions: splitCsv(p.get("disposition")),
    localityQuery: p.get("q") ?? undefined,
    region: p.get("region") ?? undefined,
    minPrice: toOptionalInt(p.get("minPrice")),
    maxPrice: toOptionalInt(p.get("maxPrice")),
    minFloorArea: toOptionalNumber(p.get("minFloorArea")),
    maxFloorArea: toOptionalNumber(p.get("maxFloorArea")),
    minLandArea: toOptionalNumber(p.get("minLandArea")),
    maxLandArea: toOptionalNumber(p.get("maxLandArea")),
    sort: p.get("sort") ?? "last_seen_desc",
    includeInactive: ["1", "true", "yes", "on"].includes((p.get("includeInactive") ?? "").toLowerCase())
  });

  if (!parsed.success) {
    throw new Error(`Invalid listing filters: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  }

  return parsed.data;
}
