import { ListingDetailPage } from "@/components/listings/ListingDetailPage";

export default async function ListingDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  return <ListingDetailPage listingId={resolved.id} />;
}
