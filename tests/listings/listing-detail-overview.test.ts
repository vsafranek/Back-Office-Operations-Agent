import { describe, expect, it } from "vitest";

import { deriveDetailSectionState, fallbackGallery, formatPrice } from "@/components/listings/listing-detail.utils";
import type { ListingDetailDto } from "@/lib/listings/types";

const baseItem: ListingDetailDto = {
  id: "listing-1",
  sourceKey: "sreality",
  sourceListingId: "s-1",
  title: "Byt 2+kk",
  description: null,
  sourceUrl: "https://example.test/listing-1",
  locality: "Praha",
  city: null,
  district: null,
  region: null,
  countryCode: "CZ",
  latitude: 50.1,
  longitude: 14.4,
  offerType: "sale",
  propertyType: "apartment",
  disposition: "2+kk",
  floorAreaM2: 56,
  landAreaM2: null,
  floorNumber: null,
  totalFloors: null,
  priceAmount: 7300000,
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
  metadata: null
};

describe("listing detail overview helpers", () => {
  it("formats price with CZ locale and fallback", () => {
    expect(formatPrice(7300000, "CZK")).toContain("CZK");
    expect(formatPrice(null, "CZK")).toBe("Cena na dotaz");
  });

  it("prefers images over preview and gallery fallback", () => {
    const imagesPreferred = fallbackGallery({
      ...baseItem,
      images: [{ url: "https://img.test/1.jpg", type: "image", sortOrder: 0, width: null, height: null }],
      previewImageUrl: "https://img.test/preview.jpg",
      galleryPreviewUrls: ["https://img.test/gallery.jpg"]
    });
    expect(imagesPreferred).toEqual(["https://img.test/1.jpg"]);
  });

  it("derives section state from missing optional data", () => {
    const state = deriveDetailSectionState(baseItem);
    expect(state).toEqual({
      mediaState: "fallback",
      contactState: "missing",
      mapState: "available",
      metadataState: "empty"
    });
  });
});
