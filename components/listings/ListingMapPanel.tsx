"use client";

import { ActionIcon, Badge, Box, Checkbox, Group, Menu, Stack, Text } from "@mantine/core";
import { IconLayersIntersect } from "@tabler/icons-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";

import type { ListingCardDto, ListingMapBounds, TransitRouteDto, TransitStopDto } from "@/lib/listings/types";

const ListingMapLibreCanvas = dynamic(
  () => import("@/components/listings/ListingMapLibreCanvas").then((mod) => mod.ListingMapLibreCanvas),
  {
    ssr: false,
    loading: () => null
  }
);

type ListingMapPanelProps = {
  items: ListingCardDto[];
  transitStops: TransitStopDto[];
  metroRoutes: TransitRouteDto[];
  layers: {
    listingMarkers: boolean;
    transitStops: boolean;
    metroRoutes: boolean;
    coverage: boolean;
  };
  onChangeLayer: (layer: "listingMarkers" | "transitStops" | "metroRoutes" | "coverage", enabled: boolean) => void;
  coverageRadiusM?: number;
  bounds: ListingMapBounds;
  selectedId: string | null;
  onSelect: (listingId: string | null) => void;
  onApplyBounds: (bounds: ListingMapBounds) => void;
};

export function ListingMapPanel({
  items,
  transitStops,
  metroRoutes,
  layers,
  onChangeLayer,
  coverageRadiusM,
  bounds,
  selectedId,
  onSelect,
  onApplyBounds
}: ListingMapPanelProps) {
  const withCoordsCount = useMemo(() => items.filter((item) => item.latitude != null && item.longitude != null).length, [items]);
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  const transitTypeSummary = useMemo(() => {
    const metro = transitStops.filter((stop) => stop.mode === "metro").length;
    const tram = transitStops.filter((stop) => stop.mode === "tram").length;
    const bus = transitStops.filter((stop) => stop.mode === "bus").length;
    const train = transitStops.filter((stop) => stop.mode === "train").length;
    return { metro, tram, bus, train };
  }, [transitStops]);
  const selectedPreviewImage = useMemo(() => {
    if (!selectedItem) return null;
    return selectedItem.galleryPreviewUrls[0] ?? selectedItem.previewImageUrl ?? null;
  }, [selectedItem]);

  return (
    <Stack gap="sm" h="100%">
      <Box
        style={{
          position: "relative",
          borderRadius: 12,
          border: "1px solid #bfdbfe",
          minHeight: 620,
          overflow: "hidden"
        }}
      >
        <ListingMapLibreCanvas
          items={items}
          transitStops={transitStops}
          metroRoutes={metroRoutes}
          showListingMarkers={layers.listingMarkers}
          showTransitStops={layers.transitStops}
          showMetroRoutes={layers.metroRoutes}
          showCoverage={layers.coverage}
          coverageRadiusM={coverageRadiusM}
          selectedId={selectedId}
          bounds={bounds}
          onSelect={onSelect}
          onBoundsChange={onApplyBounds}
        />
        <Menu shadow="md" width={240} withinPortal position="bottom-start">
          <Menu.Target>
            <ActionIcon
              variant="filled"
              color="dark"
              radius="md"
              size="lg"
              style={{ position: "absolute", top: 10, left: 10, zIndex: 5 }}
              aria-label="Nastavení vrstev mapy"
            >
              <IconLayersIntersect size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Vrstvy mapy</Menu.Label>
            <Menu.Item closeMenuOnClick={false}>
              <Checkbox
                label="Markery nabídek"
                checked={layers.listingMarkers}
                onChange={(event) => onChangeLayer("listingMarkers", event.currentTarget.checked)}
              />
            </Menu.Item>
            <Menu.Item closeMenuOnClick={false}>
              <Checkbox
                label="Zastávky MHD"
                checked={layers.transitStops}
                onChange={(event) => onChangeLayer("transitStops", event.currentTarget.checked)}
              />
            </Menu.Item>
            <Menu.Item closeMenuOnClick={false}>
              <Checkbox
                label="Trasy metra"
                checked={layers.metroRoutes}
                onChange={(event) => onChangeLayer("metroRoutes", event.currentTarget.checked)}
              />
            </Menu.Item>
            <Menu.Item closeMenuOnClick={false}>
              <Checkbox
                label="Coverage zóny"
                checked={layers.coverage}
                onChange={(event) => onChangeLayer("coverage", event.currentTarget.checked)}
              />
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        {selectedItem ? (
          <Box
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 12,
              background: "rgba(255, 255, 255, 0.95)",
              border: "1px solid #d0d7e2",
              borderRadius: 12,
              boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
              padding: 10,
              backdropFilter: "blur(3px)"
            }}
          >
            <Group align="stretch" wrap="nowrap">
              <Box
                style={{
                  width: 108,
                  minWidth: 108,
                  height: 78,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#e2e8f0"
                }}
              >
                {selectedPreviewImage ? (
                  <img
                    src={selectedPreviewImage}
                    alt={selectedItem.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : null}
              </Box>

              <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                <Text fw={700} size="sm" lineClamp={1}>
                  {selectedItem.priceAmount != null
                    ? `${selectedItem.priceAmount.toLocaleString("cs-CZ")} ${selectedItem.currency}`
                    : "Cena na dotaz"}
                </Text>
                <Text size="sm" fw={600} lineClamp={1}>
                  {selectedItem.title}
                </Text>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {selectedItem.locality}
                </Text>
                <Group gap={6}>
                  <Badge variant="light" size="sm">
                    Náhled z mapy
                  </Badge>
                  <Text size="xs" c="dimmed">
                    Vybráno kliknutím na marker
                  </Text>
                </Group>
                <Group gap={8} mt={2}>
                  <Text
                    component={Link}
                    href={`/listing/${selectedItem.id}`}
                    style={{ fontSize: 12, fontWeight: 600, color: "#1d4ed8", textDecoration: "none" }}
                  >
                    Detail
                  </Text>
                  <Text
                    component="a"
                    href={selectedItem.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, fontWeight: 600, color: "#1d4ed8", textDecoration: "none" }}
                  >
                    Originál
                  </Text>
                </Group>
              </Stack>
            </Group>
          </Box>
        ) : null}
      </Box>

      <Group justify="space-between" align="start" wrap="nowrap">
        <Stack gap={2}>
          <Badge variant="light">Body v mapě: {withCoordsCount}</Badge>
          <Text size="xs" c="dimmed">
            Zobrazeno v mapě: {withCoordsCount}/{items.length} nabídek (jen s GPS).
          </Text>
          {layers.transitStops || layers.metroRoutes ? (
            <Text size="xs" c="dimmed">
              {layers.transitStops
                ? `Zastávek v mapě: ${transitStops.length} (M:${transitTypeSummary.metro} T:${transitTypeSummary.tram} B:${transitTypeSummary.bus} V:${transitTypeSummary.train})`
                : layers.metroRoutes
                  ? `Detailní zastávky skryté (metro zastávky na trasách: ${transitTypeSummary.metro})`
                  : "Zastávky skryté"}
              {layers.metroRoutes ? ` · tras metra: ${metroRoutes.length}` : ""}
              {layers.coverage && coverageRadiusM && coverageRadiusM > 0 ? ` · zóna ${coverageRadiusM} m` : ""}
            </Text>
          ) : null}
        </Stack>
        <Text size="xs" c="dimmed" ta="right">
          Klik na částku v mapě otevře/skryje spodní náhled nabídky.
        </Text>
      </Group>
    </Stack>
  );
}

