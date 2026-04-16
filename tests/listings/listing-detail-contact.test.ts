import { describe, expect, it } from "vitest";

import { deriveDetailSectionState, extractAuthorizedContact } from "@/components/listings/listing-detail.utils";
import type { ListingDetailDto } from "@/lib/listings/types";

const baseDetail: ListingDetailDto = {
  id: "listing-1",
  sourceKey: "sreality",
  sourceListingId: "s-1",
  title: "Byt",
  description: null,
  sourceUrl: "https://example.test",
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
  metadata: null
};

describe("listing detail contact extraction", () => {
  it("extracts contact from seller and contact aliases", () => {
    const contact = extractAuthorizedContact({
      sellerName: "Makler Novy",
      sellerPhone: "+420123456789",
      contactEmail: "makler@example.test",
      sellerOrganization: "Reality s.r.o."
    });

    expect(contact).toEqual({
      name: "Makler Novy",
      phone: "+420123456789",
      email: "makler@example.test",
      organization: "Reality s.r.o."
    });
  });

  it("marks contact state as partial for one available field", () => {
    const state = deriveDetailSectionState({
      ...baseDetail,
      metadata: { sellerName: "Makler Novy" }
    });
    expect(state.contactState).toBe("partial");
  });

  it("marks contact state as available for multiple fields", () => {
    const state = deriveDetailSectionState({
      ...baseDetail,
      metadata: { sellerName: "Makler Novy", sellerPhone: "+420123456789" }
    });
    expect(state.contactState).toBe("available");
  });
});
