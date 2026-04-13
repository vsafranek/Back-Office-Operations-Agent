import type { ParsedListingInput } from "@/lib/integrations/ingestion/types";
import type { SourceListingRecord } from "@/lib/integrations/sources/source-adapter.types";

const OFFER_TYPE_MAP: Record<number, string> = {
  1: "sale",
  2: "rent",
  3: "auction"
};

const PROPERTY_TYPE_MAP: Record<number, string> = {
  1: "apartment",
  2: "house",
  3: "land",
  4: "commercial",
  5: "other"
};

type SrealityRawEstate = {
  name?: unknown;
  locality?: unknown;
  description?: unknown;
  seo?: {
    category_main_cb?: unknown;
    category_sub_cb?: unknown;
    category_type_cb?: unknown;
  };
  gps?: {
    lat?: unknown;
    lon?: unknown;
  };
  _embedded?: {
    seller?: {
      name?: unknown;
    };
  };
  _links?: {
    images?: Array<{ href?: unknown }>;
    image_middle2?: Array<{ href?: unknown }>;
  };
  price_czk?: {
    value_raw?: unknown;
    unit?: unknown;
  };
  price?: unknown;
  [key: string]: unknown;
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").replace(/\s+/g, "").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickFirstImage(raw: SrealityRawEstate): string | null {
  const images = raw._links?.images ?? raw._links?.image_middle2;
  if (!Array.isArray(images)) return null;

  for (const item of images) {
    const href = asString(item?.href);
    if (href && /^https?:\/\//i.test(href)) {
      return href;
    }
  }
  return null;
}

function extractFloorAreaM2(raw: SrealityRawEstate): number | null {
  const name = asString(raw.name) ?? "";
  const match = name.match(/(\d+(?:[.,]\d+)?)\s*m(?:2|2)/i);
  if (!match) return null;
  return asNumber(match[1]);
}

function extractDisposition(raw: SrealityRawEstate): string | null {
  const name = asString(raw.name) ?? "";
  const match = name.match(/\b(\d\+kk|\d\+1|atypick[ýy])\b/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function parseSrealityListingDeterministic(record: SourceListingRecord): ParsedListingInput | null {
  if (record.sourceKey !== "sreality") {
    return null;
  }

  const raw = record.rawPayload as SrealityRawEstate;
  const title = asString(raw.name);
  const locality = asString(raw.locality);

  if (!title || !locality) {
    return null;
  }

  const priceRaw = asNumber(raw.price_czk?.value_raw ?? raw.price);
  const imageUrl = pickFirstImage(raw);
  const lat = asNumber(raw.gps?.lat);
  const lon = asNumber(raw.gps?.lon);

  const offerTypeCb = asNumber(raw.seo?.category_type_cb);
  const propertyTypeCb = asNumber(raw.seo?.category_main_cb);
  const propertySubtypeCb = asNumber(raw.seo?.category_sub_cb);

  const floorAreaM2 = extractFloorAreaM2(raw);
  const disposition = extractDisposition(raw);
  const description = asString(raw.description);

  return {
    listing: {
      sourceKey: record.sourceKey,
      sourceListingId: record.sourceListingId,
      sourceUrl: record.sourceUrl,
      title,
      description,
      locality,
      countryCode: "CZ",
      latitude: lat,
      longitude: lon,
      offerType: offerTypeCb != null ? OFFER_TYPE_MAP[offerTypeCb] ?? null : null,
      propertyType: propertyTypeCb != null ? PROPERTY_TYPE_MAP[propertyTypeCb] ?? null : null,
      disposition,
      floorAreaM2,
      priceAmount: priceRaw != null ? Math.round(priceRaw) : null,
      currency: "CZK",
      isActive: true,
      metadata: {
        sellerName: asString(raw._embedded?.seller?.name),
        sourceCategoryMainCb: propertyTypeCb,
        sourceCategorySubCb: propertySubtypeCb
      }
    },
    media: imageUrl
      ? [
          {
            mediaUrl: imageUrl,
            mediaType: "image",
            sortOrder: 0
          }
        ]
      : [],
    parserName: "deterministic-sreality",
    parserVersion: "1.0.0",
    confidence: 0.86,
    fallbackUsed: false,
    parsedData: {
      title,
      locality,
      disposition,
      floorAreaM2,
      priceAmount: priceRaw != null ? Math.round(priceRaw) : null
    },
    diagnostics: {
      missingImage: !imageUrl,
      hadSeo: raw.seo != null,
      sourceUrl: record.sourceUrl
    },
    provenance: {
      extraction: "deterministic-rules",
      source: "sreality",
      fields: ["title", "locality", "price", "disposition", "floorAreaM2"]
    },
    enrichmentSource: null
  };
}
