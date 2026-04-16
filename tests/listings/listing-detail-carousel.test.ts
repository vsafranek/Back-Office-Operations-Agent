import { describe, expect, it } from "vitest";

import { fallbackGallery, getNextCarouselIndex, getPreviousCarouselIndex } from "@/components/listings/listing-detail.utils";
import type { ListingDetailDto } from "@/lib/listings/types";

const baseItem: Pick<ListingDetailDto, "images" | "previewImageUrl" | "galleryPreviewUrls"> = {
  images: [],
  previewImageUrl: null,
  galleryPreviewUrls: []
};

describe("listing detail carousel helpers", () => {
  it("wraps carousel index forward and backward", () => {
    expect(getNextCarouselIndex(0, 3)).toBe(1);
    expect(getNextCarouselIndex(2, 3)).toBe(0);
    expect(getPreviousCarouselIndex(0, 3)).toBe(2);
    expect(getPreviousCarouselIndex(1, 3)).toBe(0);
  });

  it("falls back to preview image when images are missing", () => {
    const gallery = fallbackGallery({
      ...baseItem,
      previewImageUrl: "https://img.test/preview.jpg"
    });
    expect(gallery).toEqual(["https://img.test/preview.jpg"]);
  });

  it("falls back to gallery previews when both images and preview are missing", () => {
    const gallery = fallbackGallery({
      ...baseItem,
      galleryPreviewUrls: ["https://img.test/a.jpg", "https://img.test/b.jpg"]
    });
    expect(gallery).toEqual(["https://img.test/a.jpg", "https://img.test/b.jpg"]);
  });
});
