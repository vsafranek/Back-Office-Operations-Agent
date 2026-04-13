"use client";

import { Badge, Box, Button, Card, Container, Group, Loader, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconExternalLink, IconMapPin } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ListingFiltersPanel } from "@/components/listings/filters/ListingFiltersPanel";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type ListingItem = {
  id: string;
  sourceKey: string;
  title: string;
  sourceUrl: string;
  locality: string;
  offerType: string | null;
  propertyType: string | null;
  disposition: string | null;
  floorAreaM2: number | null;
  priceAmount: number | null;
  currency: string;
  previewImageUrl: string | null;
  imageCount: number;
};

type ListingResponse = {
  items: ListingItem[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    hasNextPage: boolean;
  };
};

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return "Cena na dotaz";
  return `${price.toLocaleString("cs-CZ")} ${currency}`;
}

function buildQuery(params: {
  page: number;
  perPage: number;
  q: string;
  offerType: string;
  propertyType: string;
  disposition: string;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  minFloorArea: number | undefined;
  maxFloorArea: number | undefined;
  sort: string;
}): string {
  const query = new URLSearchParams();
  query.set("page", String(params.page));
  query.set("perPage", String(params.perPage));
  query.set("source", "sreality");
  if (params.q.trim()) query.set("q", params.q.trim());
  if (params.offerType) query.set("offerType", params.offerType);
  if (params.propertyType) query.set("propertyType", params.propertyType);
  if (params.disposition.trim()) query.set("disposition", params.disposition.trim());
  if (params.minPrice != null) query.set("minPrice", String(Math.round(params.minPrice)));
  if (params.maxPrice != null) query.set("maxPrice", String(Math.round(params.maxPrice)));
  if (params.minFloorArea != null) query.set("minFloorArea", String(params.minFloorArea));
  if (params.maxFloorArea != null) query.set("maxFloorArea", String(params.maxFloorArea));
  query.set("sort", params.sort || "last_seen_desc");
  return query.toString();
}

export function PortalListingsHome() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ListingItem[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ListingResponse["pagination"]>({
    page: 1,
    perPage: 24,
    total: 0,
    hasNextPage: false
  });

  const [q, setQ] = useState("");
  const [offerType, setOfferType] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [disposition, setDisposition] = useState("");
  const [sort, setSort] = useState("last_seen_desc");
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [minFloorArea, setMinFloorArea] = useState<number | undefined>(undefined);
  const [maxFloorArea, setMaxFloorArea] = useState<number | undefined>(undefined);

  async function trackClick(listingId: string, action: "detail" | "source", sourceUrl?: string) {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    void fetch("/api/market-listings/click", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ listingId, action, sourceUrl }),
      keepalive: true
    }).catch(() => {});
  }

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
        setError("Pro zobrazení nabídek se prosím přihlas.");
        return;
      }

      const qs = buildQuery({
        page,
        perPage: 24,
        q,
        offerType,
        propertyType,
        disposition,
        minPrice,
        maxPrice,
        minFloorArea,
        maxFloorArea,
        sort
      });

      const response = await fetch(`/api/market-listings?${qs}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!alive) return;
        setError(body.error ?? `Chyba načtení (${response.status})`);
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as ListingResponse;
      if (!alive) return;

      setItems(payload.items);
      setPagination(payload.pagination);
      setLoading(false);
    }

    void load();
    return () => {
      alive = false;
    };
  }, [supabase, page, q, offerType, propertyType, disposition, minPrice, maxPrice, minFloorArea, maxFloorArea, sort]);

  return (
    <Box component="main" style={{ background: "#f4f6fb", minHeight: "100%" }}>
      <Container size="xl" py="lg">
        <Stack gap="lg">
          <Group justify="space-between" align="end">
            <div>
              <Title order={1} size="h2" fw={800}>
                Realitní portál
              </Title>
              <Text c="dimmed" mt={4}>
                Zillow-like MVP: import ze Sreality, centralizovaný listing a detailní filtry.
              </Text>
            </div>
            <Badge size="lg" color="blue" variant="light">
              Záznamů: {pagination.total.toLocaleString("cs-CZ")}
            </Badge>
          </Group>

          <ListingFiltersPanel
            q={q}
            setQ={setQ}
            offerType={offerType}
            setOfferType={setOfferType}
            propertyType={propertyType}
            setPropertyType={setPropertyType}
            disposition={disposition}
            setDisposition={setDisposition}
            sort={sort}
            setSort={setSort}
            minPrice={minPrice}
            setMinPrice={setMinPrice}
            maxPrice={maxPrice}
            setMaxPrice={setMaxPrice}
            minFloorArea={minFloorArea}
            setMinFloorArea={setMinFloorArea}
            maxFloorArea={maxFloorArea}
            setMaxFloorArea={setMaxFloorArea}
            currentPage={pagination.page}
            currentCount={items.length}
            onChangePageToFirst={() => setPage(1)}
            onReset={() => {
              setPage(1);
              setQ("");
              setOfferType("");
              setPropertyType("");
              setDisposition("");
              setSort("last_seen_desc");
              setMinPrice(undefined);
              setMaxPrice(undefined);
              setMinFloorArea(undefined);
              setMaxFloorArea(undefined);
            }}
          />

          {error ? (
            <Card withBorder radius="md" p="lg">
              <Stack gap="sm">
                <Text c="red" fw={600}>
                  {error}
                </Text>
                <Group>
                  <Button component={Link} href="/auth/login">
                    Přihlásit se
                  </Button>
                </Group>
              </Stack>
            </Card>
          ) : null}

          {loading ? (
            <Group justify="center" py="xl">
              <Loader size="lg" />
            </Group>
          ) : null}

          {!loading && !error ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {items.map((listing) => (
                <Card key={listing.id} withBorder radius="lg" padding={0} bg="white" style={{ overflow: "hidden" }}>
                  <Box style={{ position: "relative", height: 210, background: "#eef2f8" }}>
                    {listing.previewImageUrl ? (
                      <img
                        src={listing.previewImageUrl}
                        alt={listing.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <Group justify="center" align="center" h="100%">
                        <Text c="dimmed" size="sm">
                          Bez náhledu
                        </Text>
                      </Group>
                    )}
                    <Badge
                      color="dark"
                      variant="filled"
                      style={{ position: "absolute", top: 12, left: 12, textTransform: "uppercase" }}
                    >
                      {listing.sourceKey}
                    </Badge>
                  </Box>

                  <Stack p="md" gap="xs">
                    <Text fw={800} size="lg">
                      {formatPrice(listing.priceAmount, listing.currency)}
                    </Text>
                    <Text fw={600} lineClamp={2}>
                      {listing.title}
                    </Text>
                    <Group gap={6} c="dimmed">
                      <IconMapPin size={15} />
                      <Text size="sm" lineClamp={1}>
                        {listing.locality}
                      </Text>
                    </Group>

                    <Group gap="xs" wrap="wrap" mt={4}>
                      {listing.propertyType ? <Badge variant="light">{listing.propertyType}</Badge> : null}
                      {listing.offerType ? <Badge variant="light">{listing.offerType}</Badge> : null}
                      {listing.disposition ? <Badge variant="light">{listing.disposition}</Badge> : null}
                      {listing.floorAreaM2 ? <Badge variant="outline">{listing.floorAreaM2} m2</Badge> : null}
                    </Group>

                    <Group justify="space-between" mt="sm">
                      <Text size="xs" c="dimmed">
                        Fotek: {listing.imageCount}
                      </Text>
                      <Group gap="xs">
                        <Button
                          component={Link}
                          href={`/listing/${listing.id}`}
                          variant="default"
                          size="xs"
                          onClick={() => {
                            void trackClick(listing.id, "detail");
                          }}
                        >
                          Detail
                        </Button>
                        <Button
                          component="a"
                          href={listing.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="xs"
                          rightSection={<IconExternalLink size={14} />}
                          onClick={() => {
                            void trackClick(listing.id, "source", listing.sourceUrl);
                          }}
                        >
                          Originál
                        </Button>
                      </Group>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          ) : null}

          {!loading && !error ? (
            <Group justify="space-between" mt="md">
              <Button variant="default" disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Předchozí
              </Button>
              <Text size="sm" c="dimmed">
                Strana {pagination.page} / {Math.max(1, Math.ceil(pagination.total / pagination.perPage))}
              </Text>
              <Button disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}>
                Další
              </Button>
            </Group>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}
