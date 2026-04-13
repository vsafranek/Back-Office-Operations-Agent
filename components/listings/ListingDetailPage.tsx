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

import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type ListingDetail = {
  id: string;
  sourceKey: string;
  sourceListingId: string;
  title: string;
  description: string | null;
  sourceUrl: string;
  locality: string;
  city: string | null;
  district: string | null;
  region: string | null;
  offerType: string | null;
  propertyType: string | null;
  disposition: string | null;
  floorAreaM2: number | null;
  landAreaM2: number | null;
  floorNumber: number | null;
  totalFloors: number | null;
  priceAmount: number | null;
  currency: string;
  previewImageUrl: string | null;
  imageCount: number;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown> | null;
  images: Array<{
    url: string;
    type: string;
    sortOrder: number;
    width: number | null;
    height: number | null;
  }>;
};

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return "Cena na dotaz";
  return `${price.toLocaleString("cs-CZ")} ${currency}`;
}

export function ListingDetailPage({ listingId }: { listingId: string }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<ListingDetail | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        if (!alive) return;
        setLoading(false);
        setError("Pro zobrazení detailu se prosím pøihlas.");
        return;
      }

      const response = await fetch(`/api/market-listings/${listingId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!alive) return;
        setError(body.error ?? `Chyba naètení detailu (${response.status})`);
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as { item: ListingDetail };
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
            Zpìt na výpis
          </Button>
          <Alert color="red" title="Detail se nepodaøilo naèíst">
            {error ?? "Inzerát nebyl nalezen."}
          </Alert>
        </Stack>
      </Container>
    );
  }

  const mapLink =
    item.latitude != null && item.longitude != null
      ? `https://www.google.com/maps?q=${item.latitude},${item.longitude}`
      : null;

  return (
    <Box component="main" style={{ background: "#f4f6fb", minHeight: "100%" }}>
      <Container size="xl" py="lg">
        <Stack gap="lg">
          <Group justify="space-between">
            <Button component={Link} href="/" variant="subtle" leftSection={<IconArrowLeft size={16} />}>
              Zpìt na výpis
            </Button>
            <Button component="a" href={item.sourceUrl} target="_blank" rel="noopener noreferrer" rightSection={<IconExternalLink size={14} />}>
              Otevøít originál
            </Button>
          </Group>

          <Card withBorder radius="lg" p="lg">
            <Stack gap="sm">
              <Group gap="xs" wrap="wrap">
                <Badge color="dark" variant="filled">{item.sourceKey}</Badge>
                {item.offerType ? <Badge variant="light">{item.offerType}</Badge> : null}
                {item.propertyType ? <Badge variant="light">{item.propertyType}</Badge> : null}
                {item.disposition ? <Badge variant="light">{item.disposition}</Badge> : null}
              </Group>

              <Title order={1} size="h2">{item.title}</Title>
              <Text fw={800} size="xl">{formatPrice(item.priceAmount, item.currency)}</Text>

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
              </Group>

              {mapLink ? (
                <Button component="a" href={mapLink} target="_blank" rel="noopener noreferrer" variant="light" w="fit-content" rightSection={<IconExternalLink size={14} />}>
                  Otevøít na mapì
                </Button>
              ) : null}
            </Stack>
          </Card>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {(item.images.length > 0 ? item.images : item.previewImageUrl ? [{ url: item.previewImageUrl, type: "image", sortOrder: 0, width: null, height: null }] : []).map((image) => (
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
