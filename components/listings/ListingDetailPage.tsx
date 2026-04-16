"use client";

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Image,
  Paper,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title
} from "@mantine/core";
import {
  IconArrowLeft,
  IconBuildingCommunity,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconExternalLink,
  IconMapPin,
  IconTrain
} from "@tabler/icons-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { SavedListingButton } from "@/components/listings/SavedListingButton";
import {
  deriveDetailSectionState,
  extractAuthorizedContact,
  fallbackGallery,
  formatDate,
  formatPrice,
  getNextCarouselIndex,
  getPreviousCarouselIndex,
  hasNeighborhoodPreview
} from "@/components/listings/listing-detail.utils";
import type { ListingDetailDto } from "@/lib/listings/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

const ListingDetailNeighborhoodMap = dynamic(
  () => import("@/components/listings/ListingDetailNeighborhoodMap").then((mod) => mod.ListingDetailNeighborhoodMap),
  { ssr: false }
);

function DetailFact({
  label,
  value,
  icon
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Stack gap={4}>
        <Group gap={6}>
          {icon}
          <Text size="xs" c="dimmed" fw={600}>
            {label}
          </Text>
        </Group>
        <Text fw={700} size="sm">
          {value}
        </Text>
      </Stack>
    </Paper>
  );
}

export function ListingDetailPage({ listingId }: { listingId: string }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<(ListingDetailDto & { isSaved?: boolean }) | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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

  useEffect(() => {
    setActiveImageIndex(0);
  }, [item?.id]);

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
  const gallery = fallbackGallery(item);
  const activeImage = gallery[activeImageIndex] ?? null;
  const contact = extractAuthorizedContact(item.metadata);
  const sectionState = deriveDetailSectionState(item);
  const hasContactInfo = Boolean(contact.name || contact.phone || contact.email || contact.organization);

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

          <Card withBorder radius="lg" p={0} style={{ overflow: "hidden" }}>
            <Box style={{ position: "relative", background: "#dbe2ef" }}>
              {activeImage ? (
                <Image src={activeImage} alt={item.title} h="clamp(240px, 52vw, 460px)" fit="cover" />
              ) : (
                <Group h="clamp(240px, 52vw, 460px)" justify="center">
                  <Text c="dimmed">Bez dostupných fotografií</Text>
                </Group>
              )}
              {gallery.length > 1 ? (
                <>
                  <Button
                    variant="filled"
                    color="dark"
                    radius="xl"
                    size="compact-md"
                    onClick={() => setActiveImageIndex((current) => getPreviousCarouselIndex(current, gallery.length))}
                    style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
                    aria-label="Předchozí fotografie"
                  >
                    <IconChevronLeft size={16} />
                  </Button>
                  <Button
                    variant="filled"
                    color="dark"
                    radius="xl"
                    size="compact-md"
                    onClick={() => setActiveImageIndex((current) => getNextCarouselIndex(current, gallery.length))}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}
                    aria-label="Další fotografie"
                  >
                    <IconChevronRight size={16} />
                  </Button>
                  <Badge style={{ position: "absolute", right: 12, bottom: 12 }} color="dark">
                    {activeImageIndex + 1} / {gallery.length}
                  </Badge>
                </>
              ) : null}
            </Box>

            {gallery.length > 1 ? (
              <Group gap={8} p="sm" wrap="nowrap" style={{ overflowX: "auto" }}>
                {gallery.map((imageUrl, index) => (
                  <Button
                    key={`${imageUrl}-${index}`}
                    onClick={() => setActiveImageIndex(index)}
                    variant="subtle"
                    p={0}
                    mih={0}
                    h="auto"
                    aria-label={`Zobrazit fotografii ${index + 1}`}
                    aria-current={index === activeImageIndex ? "true" : undefined}
                    style={{
                      cursor: "pointer",
                      borderRadius: 8,
                      overflow: "hidden",
                      border: index === activeImageIndex ? "2px solid #1d4ed8" : "1px solid #d0d7e2",
                      minWidth: 124
                    }}
                  >
                    <Image src={imageUrl} alt={`${item.title} ${index + 1}`} w={124} h={78} fit="cover" />
                  </Button>
                ))}
              </Group>
            ) : null}
          </Card>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
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

                {item.description ? <Text c="dimmed">{item.description}</Text> : <Text c="dimmed">Popis není k dispozici.</Text>}

                <Divider my="xs" />

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <DetailFact label="Plocha" value={item.floorAreaM2 != null ? `${item.floorAreaM2} m2` : "neuvedeno"} />
                  <DetailFact label="Pozemek" value={item.landAreaM2 != null ? `${item.landAreaM2} m2` : "neuvedeno"} />
                  <DetailFact label="Patro" value={item.floorNumber != null ? item.floorNumber : "neuvedeno"} />
                  <DetailFact label="Celkem pater" value={item.totalFloors != null ? item.totalFloors : "neuvedeno"} />
                  <DetailFact label="Cena poznámka" value={item.priceNote ?? "neuvedeno"} />
                  <DetailFact label="Lokalita" value={item.city ?? item.district ?? item.region ?? "neuvedeno"} />
                </SimpleGrid>

                <Group gap="sm" mt="sm">
                  {mapLink ? (
                    <Button
                      component="a"
                      href={mapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="light"
                      rightSection={<IconExternalLink size={14} />}
                    >
                      Otevřít lokalitu v mapě
                    </Button>
                  ) : null}
                </Group>
              </Stack>
            </Card>

            <Stack gap="md">
              <Card withBorder radius="lg" p="lg">
                <Stack gap="sm">
                  <Title order={3}>Transit a dostupnost</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <DetailFact
                      label="Metro pěšky"
                      value={item.transit?.nearestMetroWalkMin != null ? `${item.transit.nearestMetroWalkMin} min` : "neuvedeno"}
                      icon={<IconTrain size={14} />}
                    />
                    <DetailFact
                      label="Transit score"
                      value={item.transit?.transitScore != null ? item.transit.transitScore : "neuvedeno"}
                      icon={<IconBuildingCommunity size={14} />}
                    />
                    <DetailFact
                      label="Metro linka"
                      value={item.transit?.nearestMetroLine ?? "neuvedeno"}
                      icon={<IconTrain size={14} />}
                    />
                    <DetailFact
                      label="Naposledy viděno"
                      value={formatDate(item.lastSeenAt) ?? "neuvedeno"}
                      icon={<IconClock size={14} />}
                    />
                  </SimpleGrid>
                </Stack>
              </Card>

              <Card withBorder radius="lg" p="lg">
                <Stack gap="sm">
                  <Title order={3}>Náhled sousedství</Title>
                  {hasNeighborhoodPreview(item) ? (
                    <Box style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #d0d7e2", height: 240 }}>
                      <ListingDetailNeighborhoodMap
                        latitude={item.latitude as number}
                        longitude={item.longitude as number}
                        title={item.title}
                      />
                    </Box>
                  ) : (
                    <Text c="dimmed">Mapový náhled není dostupný (chybí GPS).</Text>
                  )}
                </Stack>
              </Card>

              <Card withBorder radius="lg" p="lg">
                <Stack gap="sm">
                  <Title order={3}>Kontakt na oprávněnou osobu</Title>
                  {hasContactInfo ? (
                    <>
                      <DetailFact label="Jméno / subjekt" value={contact.name ?? contact.organization ?? "neuvedeno"} />
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                        <DetailFact
                          label="Telefon"
                          value={
                            contact.phone ? (
                              <Text component="a" href={`tel:${contact.phone.replace(/\s+/g, "")}`} c="blue.7" style={{ textDecoration: "none" }}>
                                {contact.phone}
                              </Text>
                            ) : (
                              "neuvedeno"
                            )
                          }
                        />
                        <DetailFact
                          label="Email"
                          value={
                            contact.email ? (
                              <Text component="a" href={`mailto:${contact.email}`} c="blue.7" style={{ textDecoration: "none" }}>
                                {contact.email}
                              </Text>
                            ) : (
                              "neuvedeno"
                            )
                          }
                        />
                      </SimpleGrid>
                    </>
                  ) : (
                    <Text c="dimmed">
                      Přímý kontakt není v datech dostupný. Použij tlačítko &quot;Otevřít originál&quot; pro kontaktování inzerenta.
                    </Text>
                  )}
                </Stack>
              </Card>
            </Stack>
          </SimpleGrid>

          <Card withBorder radius="lg" p="lg">
            <Stack gap="sm">
              <Title order={3}>Metadata</Title>
              <Text size="sm" c="dimmed">
                Zdrojové informace o inzerátu:
              </Text>
              <Box
                style={{
                  borderRadius: 10,
                  border: "1px solid #d0d7e2",
                  background: "#f8fafc",
                  padding: 12,
                  maxHeight: 260,
                  overflow: "auto"
                }}
              >
                <Text component="pre" size="xs" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(item.metadata ?? {}, null, 2)}
                </Text>
              </Box>
              <Text size="xs" c="dimmed">
                Stav sekcí: media={sectionState.mediaState}, map={sectionState.mapState}, kontakt={sectionState.contactState}, metadata={sectionState.metadataState}
              </Text>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
