import type { ListingDetailDto } from "@/lib/listings/types";

export type AuthorizedContact = {
  name: string | null;
  phone: string | null;
  email: string | null;
  organization: string | null;
};

export type DetailSectionState = {
  mediaState: "ready" | "fallback";
  contactState: "available" | "partial" | "missing";
  mapState: "available" | "missing";
  metadataState: "available" | "empty";
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function formatPrice(price: number | null, currency: string): string {
  if (price == null) return "Cena na dotaz";
  return `${price.toLocaleString("cs-CZ")} ${currency}`;
}

export function formatDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("cs-CZ");
}

export function fallbackGallery(item: Pick<ListingDetailDto, "images" | "previewImageUrl" | "galleryPreviewUrls">): string[] {
  const fromImages = item.images.map((image) => image.url).filter(Boolean);
  if (fromImages.length > 0) return fromImages;
  if (item.previewImageUrl) return [item.previewImageUrl];
  if (item.galleryPreviewUrls.length > 0) return item.galleryPreviewUrls;
  return [];
}

export function extractAuthorizedContact(metadata: Record<string, unknown> | null): AuthorizedContact {
  if (!metadata) {
    return { name: null, phone: null, email: null, organization: null };
  }

  return {
    name:
      asNonEmptyString(metadata.sellerName) ??
      asNonEmptyString(metadata.contactName) ??
      asNonEmptyString(metadata.representativeName) ??
      null,
    phone:
      asNonEmptyString(metadata.phone) ??
      asNonEmptyString(metadata.contactPhone) ??
      asNonEmptyString(metadata.sellerPhone) ??
      null,
    email:
      asNonEmptyString(metadata.email) ??
      asNonEmptyString(metadata.contactEmail) ??
      asNonEmptyString(metadata.sellerEmail) ??
      null,
    organization:
      asNonEmptyString(metadata.agencyName) ??
      asNonEmptyString(metadata.organization) ??
      asNonEmptyString(metadata.sellerOrganization) ??
      null
  };
}

export function getNextCarouselIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current + 1) % total;
}

export function getPreviousCarouselIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current - 1 + total) % total;
}

export function hasNeighborhoodPreview(item: Pick<ListingDetailDto, "latitude" | "longitude">): boolean {
  return item.latitude != null && item.longitude != null;
}

export function deriveDetailSectionState(item: ListingDetailDto): DetailSectionState {
  const gallery = fallbackGallery(item);
  const contact = extractAuthorizedContact(item.metadata);
  const contactValues = [contact.name, contact.organization, contact.phone, contact.email].filter(Boolean).length;
  const metadataKeys = item.metadata ? Object.keys(item.metadata).length : 0;

  return {
    mediaState: gallery.length > 0 ? "ready" : "fallback",
    contactState: contactValues === 0 ? "missing" : contactValues === 1 ? "partial" : "available",
    mapState: hasNeighborhoodPreview(item) ? "available" : "missing",
    metadataState: metadataKeys > 0 ? "available" : "empty"
  };
}
