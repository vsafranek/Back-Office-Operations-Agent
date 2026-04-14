"use client";

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title
} from "@mantine/core";
import { IconArrowLeft, IconExternalLink, IconMapPin } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { SavedListingButton } from "@/components/listings/SavedListingButton";
import type { ListingDetailDto } from "@/lib/listings/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return "Cena na dotaz";
  return `${price.toLocaleString("cs-CZ")} ${currency}`;
}

export function ListingDetailPage({ listingId }: { listingId: string }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<(ListingDetailDto & { isSaved?: boolean }) | null>(null);

  async function toggleSaved(nextSaved: boolean) {
    if (!item) return;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      setError("Pro ukládání nabídek se prosím přihlas.");
      return;
    }

    const response = await fetch(nextSaved ? "/api/saved-listings" : `/api/saved-listings/${item.id}`, {
      method: nextSaved ? "POST" : "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: nextSaved ? JSON.stringify({ listingId: item.id }) : undefined
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Změna oblíbených selhala.");
      return;
    }

    setItem((current) => (current ? { ...current, isSaved: nextSaved } : current));
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`/api/market-listings/${listingId}`, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`
            }
          : undefined
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!alive) return;
        setError(body.error ?? `Chyba načtení detailu (${response.status})`);
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as { item: ListingDetailDto & { isSaved?: boolean } };
      if (!alive) return;

      setItem(payload.item);
      setLoading(false);
    }

    void load();
    return () => {
      alive = false;
    };
  }, [supabase, listingId]);

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Group justify="center" py="xl">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (error || !item) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="md">
          <Button component={Link} href="/" variant="subtle" leftSection={<IconArrowLeft size={16} />} w="fit-content">
            Zpět na výpis
          </Button>
          <Alert color="red" title="Detail se nepodařilo načíst">
            {error ?? "Inzerát nebyl nalezen."}
          </Alert>
        </Stack>
      </Container>
    );
  }

  const mapLink =
    item.latitude != null && item.longitude != null ? `https://www.google.com/maps?q=${item.latitude},${item.longitude}` : null;

  return (
    <Box component="main" style={{ background: "#f4f6fb", minHeight: "100%" }}>
      <Container size="xl" py="lg">
        <Stack gap="lg">
          <Group justify="space-between">
            <Button component={Link} href="/" variant="subtle" leftSection={<IconArrowLeft size={16} />}>
              Zpět na výpis
            </Button>
            <Group>
              <SavedListingButton listingId={item.id} isSaved={Boolean(item.isSaved)} onToggle={(_, next) => void toggleSaved(next)} />
              <Button component="a" href={item.sourceUrl} target="_blank" rel="noopener noreferrer" rightSection={<IconExternalLink size={14} />}>
                Otevřít originál
              </Button>
            </Group>
          </Group>

          <Card withBorder radius="lg" p="lg">
            <Stack gap="sm">
              <Group gap="xs" wrap="wrap">
                <Badge color="dark" variant="filled">
                  {item.sourceKey}
                </Badge>
                {item.offerType ? <Badge variant="light">{item.offerType}</Badge> : null}
                {item.propertyType ? <Badge variant="light">{item.propertyType}</Badge> : null}
                {item.disposition ? <Badge variant="light">{item.disposition}</Badge> : null}
                {!item.isActive ? <Badge color="gray">Inzerát je neaktivní</Badge> : null}
              </Group>

              <Title order={1} size="h2">
                {item.title}
              </Title>
              <Text fw={800} size="xl">
                {formatPrice(item.priceAmount, item.currency)}
              </Text>

              <Group gap={6} c="dimmed">
                <IconMapPin size={16} />
                <Text>{item.locality}</Text>
              </Group>

              {item.description ? <Text c="dimmed">{item.description}</Text> : null}

              <Group gap="md" wrap="wrap" mt="xs">
                {item.floorAreaM2 != null ? <Badge variant="outline">Plocha: {item.floorAreaM2} m2</Badge> : null}
                {item.landAreaM2 != null ? <Badge variant="outline">Pozemek: {item.landAreaM2} m2</Badge> : null}
                {item.floorNumber != null ? <Badge variant="outline">Patro: {item.floorNumber}</Badge> : null}
                {item.totalFloors != null ? <Badge variant="outline">Celkem pater: {item.totalFloors}</Badge> : null}
                {item.transit?.nearestMetroWalkMin != null ? (
                  <Badge color="blue" variant="light">
                    Metro: {item.transit.nearestMetroWalkMin} min
                  </Badge>
                ) : null}
                {item.transit?.transitScore != null ? (
                  <Badge color="teal" variant="outline">
                    Transit score: {item.transit.transitScore}
                  </Badge>
                ) : null}
              </Group>

              {mapLink ? (
                <Button
                  component="a"
                  href={mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="light"
                  w="fit-content"
                  rightSection={<IconExternalLink size={14} />}
                >
                  Otevřít na mapě
                </Button>
              ) : null}
            </Stack>
          </Card>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {(item.images.length > 0
              ? item.images
              : item.previewImageUrl
                ? [{ url: item.previewImageUrl, type: "image", sortOrder: 0, width: null, height: null }]
                : []
            ).map((image) => (
              <Card key={`${image.sortOrder}-${image.url}`} withBorder radius="md" p={0} style={{ overflow: "hidden" }}>
                <img src={image.url} alt={item.title} style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
}
