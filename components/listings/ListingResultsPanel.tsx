"use client";

import { ActionIcon, Badge, Box, Button, Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconExternalLink } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { SavedListingButton } from "@/components/listings/SavedListingButton";
import type { ListingCardDto } from "@/lib/listings/types";

type ListingResultsPanelProps = {
  items: ListingCardDto[];
  selectedId: string | null;
  onSelect: (listingId: string) => void;
  onToggleSaved: (listingId: string, nextSaved: boolean) => void;
  layout?: "mapGrid" | "listGrid";
  hasActiveTransitFilters?: boolean;
};

function formatPrice(value: number | null, currency: string): string {
  if (value == null) return "Cena na dotaz";
  return `${value.toLocaleString("cs-CZ")} ${currency}`;
}

function ListingImageCarousel({ listing, height }: { listing: ListingCardDto; height: number }) {
  const images = useMemo(() => {
    if (listing.galleryPreviewUrls.length > 0) return listing.galleryPreviewUrls;
    if (listing.previewImageUrl) return [listing.previewImageUrl];
    return [];
  }, [listing.galleryPreviewUrls, listing.previewImageUrl]);

  const [index, setIndex] = useState(0);
  const current = images[index] ?? null;

  if (!current) {
    return (
      <Box style={{ height, background: "#eef2f8", borderRadius: 10 }}>
        <Group justify="center" align="center" h="100%">
          <Text size="sm" c="dimmed">
            Bez náhledu
          </Text>
        </Group>
      </Box>
    );
  }

  return (
    <Box style={{ position: "relative", height, borderRadius: 10, overflow: "hidden", background: "#eef2f8" }}>
      <img src={current} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />

      {images.length > 1 ? (
        <>
          <ActionIcon
            variant="filled"
            color="dark"
            radius="xl"
            size="sm"
            style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}
            onClick={() => setIndex((prev) => (prev - 1 + images.length) % images.length)}
            aria-label="Předchozí obrázek"
          >
            <IconChevronLeft size={14} />
          </ActionIcon>

          <ActionIcon
            variant="filled"
            color="dark"
            radius="xl"
            size="sm"
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}
            onClick={() => setIndex((prev) => (prev + 1) % images.length)}
            aria-label="Další obrázek"
          >
            <IconChevronRight size={14} />
          </ActionIcon>

          <Badge variant="filled" color="dark" style={{ position: "absolute", right: 8, bottom: 8 }}>
            {index + 1}/{images.length}
          </Badge>
        </>
      ) : null}
    </Box>
  );
}

export function ListingResultsPanel({
  items,
  selectedId,
  onSelect,
  onToggleSaved,
  layout = "listGrid",
  hasActiveTransitFilters = false
}: ListingResultsPanelProps) {
  if (items.length === 0) {
    return (
      <Card withBorder radius="md" p="lg">
        <Text c="dimmed">
          {hasActiveTransitFilters
            ? "Žádné nabídky neodpovídají aktivním dopravním filtrům. Zkus uvolnit limity metra/režimů."
            : "Žádné nabídky v aktuálním mapovém výřezu."}
        </Text>
      </Card>
    );
  }

  const compact = layout === "listGrid";
  const cols = layout === "mapGrid" ? { base: 1, sm: 2, lg: 2, xl: 2 } : { base: 1, sm: 2, md: 3, lg: 4, xl: 5 };

  return (
    <SimpleGrid cols={cols} spacing={compact ? "sm" : "md"}>
      {items.map((listing) => (
        <Card
          key={listing.id}
          withBorder
          radius="md"
          p={compact ? "xs" : "sm"}
          style={{
            borderColor: selectedId === listing.id ? "#228be6" : undefined,
            boxShadow: selectedId === listing.id ? "0 0 0 1px #228be6" : undefined
          }}
          onMouseEnter={() => onSelect(listing.id)}
        >
          <Stack gap={compact ? "xs" : "sm"}>
            <ListingImageCarousel listing={listing} height={compact ? 150 : 185} />

            <Group justify="space-between" align="start" wrap="nowrap">
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Text fw={700} size={compact ? "sm" : "md"}>
                  {formatPrice(listing.priceAmount, listing.currency)}
                </Text>
                <Text fw={600} size={compact ? "xs" : "sm"} lineClamp={2}>
                  {listing.title}
                </Text>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {listing.locality}
                </Text>
              </Stack>
              <SavedListingButton listingId={listing.id} isSaved={Boolean(listing.isSaved)} onToggle={onToggleSaved} />
            </Group>

            <Group gap={6} wrap="wrap">
              {listing.disposition ? <Badge size={compact ? "xs" : "sm"} variant="light">{listing.disposition}</Badge> : null}
              {listing.floorAreaM2 ? <Badge size={compact ? "xs" : "sm"} variant="outline">{listing.floorAreaM2} m²</Badge> : null}
              {listing.latitude == null || listing.longitude == null ? (
                <Badge size={compact ? "xs" : "sm"} color="gray" variant="light">
                  Bez GPS
                </Badge>
              ) : null}
              {listing.transit?.nearestMetroWalkMin != null ? (
                <Badge size={compact ? "xs" : "sm"} color="blue" variant="light">
                  Metro {listing.transit.nearestMetroWalkMin} min
                </Badge>
              ) : null}
              {listing.transit?.transitScore != null ? (
                <Badge size={compact ? "xs" : "sm"} color="teal" variant="outline">
                  Transit {listing.transit.transitScore}
                </Badge>
              ) : null}
              {!listing.transit ? (
                <Badge size={compact ? "xs" : "sm"} color="gray" variant="outline">
                  Transit profil nedostupný
                </Badge>
              ) : null}
              {!listing.isActive ? <Badge size={compact ? "xs" : "sm"} color="gray">Neaktivní</Badge> : null}
            </Group>

            <Group justify="space-between" mt={2}>
              <Button component={Link} href={`/listing/${listing.id}`} variant="default" size={compact ? "xs" : "sm"}>
                Detail
              </Button>
              <Button
                component="a"
                href={listing.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                size={compact ? "xs" : "sm"}
                rightSection={<IconExternalLink size={13} />}
              >
                Originál
              </Button>
            </Group>
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
}
