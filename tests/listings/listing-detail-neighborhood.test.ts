import { describe, expect, it } from "vitest";

import { deriveDetailSectionState, hasNeighborhoodPreview } from "@/components/listings/listing-detail.utils";
import type { ListingDetailDto } from "@/lib/listings/types";

function makeDetail(overrides: Partial<ListingDetailDto>): ListingDetailDto {
  return {
    id: "listing-1",
    sourceKey: "sreality",
    sourceListingId: "s-1",
    title: "Byt 3+kk",
    description: null,
    sourceUrl: "https://example.test/listing-1",
    locality: "Praha",
    city: null,
    district: null,
    region: null,
    countryCode: "CZ",
    latitude: 50.1,
    longitude: 14.4,
    offerType: null,
    propertyType: null,
    disposition: null,
    floorAreaM2: null,
    landAreaM2: null,
    floorNumber: null,
    totalFloors: null,
    priceAmount: null,
    currency: "CZK",
    priceNote: null,
    isActive: true,
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-02T00:00:00.000Z",
    publishedAt: null,
    previewImageUrl: null,
    galleryPreviewUrls: [],
    imageCount: 0,
    images: [],
    metadata: null,
    ...overrides
  };
}

describe("listing detail neighborhood state", () => {
  it("returns neighborhood available when both coordinates exist", () => {
    expect(hasNeighborhoodPreview(makeDetail({}))).toBe(true);
  });

  it("returns neighborhood missing when either coordinate is absent", () => {
    expect(hasNeighborhoodPreview(makeDetail({ latitude: null }))).toBe(false);
    expect(hasNeighborhoodPreview(makeDetail({ longitude: null }))).toBe(false);
  });

  it("derives mapState as missing without coordinates", () => {
    const state = deriveDetailSectionState(makeDetail({ latitude: null, longitude: null }));
    expect(state.mapState).toBe("missing");
  });
});
