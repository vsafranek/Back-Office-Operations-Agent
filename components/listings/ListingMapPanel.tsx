"use client";

import { Badge, Box, Group, NumberInput, Stack, Text } from "@mantine/core";
import dynamic from "next/dynamic";
import { useMemo } from "react";

import type { ListingCardDto, ListingMapBounds } from "@/lib/listings/types";

const ListingLeafletCanvas = dynamic(
  () => import("@/components/listings/ListingLeafletCanvas").then((mod) => mod.ListingLeafletCanvas),
  {
    ssr: false,
    loading: () => (
      <Group justify="center" align="center" h="100%">
        <Text c="dimmed">Načítám mapu...</Text>
      </Group>
    )
  }
);

type ListingMapPanelProps = {
  items: ListingCardDto[];
  bounds: ListingMapBounds;
  selectedId: string | null;
  onSelect: (listingId: string) => void;
  onApplyBounds: (bounds: ListingMapBounds) => void;
};

export function ListingMapPanel({ items, bounds, selectedId, onSelect, onApplyBounds }: ListingMapPanelProps) {
  const withCoordsCount = useMemo(() => items.filter((item) => item.latitude != null && item.longitude != null).length, [items]);

  return (
    <Stack gap="sm" h="100%">
      <Group grow>
        <NumberInput
          size="xs"
          label="North"
          value={bounds.north}
          onChange={(value) => onApplyBounds({ ...bounds, north: Number(value) || bounds.north })}
        />
        <NumberInput
          size="xs"
          label="South"
          value={bounds.south}
          onChange={(value) => onApplyBounds({ ...bounds, south: Number(value) || bounds.south })}
        />
        <NumberInput
          size="xs"
          label="East"
          value={bounds.east}
          onChange={(value) => onApplyBounds({ ...bounds, east: Number(value) || bounds.east })}
        />
        <NumberInput
          size="xs"
          label="West"
          value={bounds.west}
          onChange={(value) => onApplyBounds({ ...bounds, west: Number(value) || bounds.west })}
        />
      </Group>

      <Box
        style={{
          position: "relative",
          borderRadius: 12,
          border: "1px solid #bfdbfe",
          minHeight: 620,
          overflow: "hidden"
        }}
      >
        <ListingLeafletCanvas items={items} selectedId={selectedId} bounds={bounds} onSelect={onSelect} onBoundsChange={onApplyBounds} />
      </Box>

      <Group justify="space-between" align="start" wrap="nowrap">
        <Stack gap={2}>
          <Badge variant="light">Body v mapě: {withCoordsCount}</Badge>
          <Text size="xs" c="dimmed">
            Zobrazeno v mapě: {withCoordsCount}/{items.length} nabídek (jen s GPS).
          </Text>
        </Stack>
        <Text size="xs" c="dimmed" ta="right">
          Klikni na bod v mapě pro detailní popup nabídky.
        </Text>
      </Group>
    </Stack>
  );
}
