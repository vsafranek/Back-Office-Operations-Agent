"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

import { ListingFiltersPanel } from "@/components/listings/filters/ListingFiltersPanel";
import { ListingMapPanel } from "@/components/listings/ListingMapPanel";
import { ListingResultsPanel } from "@/components/listings/ListingResultsPanel";
import { isSplitMapListEnabled, isTransitMapOverlayEnabled } from "@/lib/config/portal";
import type { ListingCardDto, ListingMapBounds, ListingSearchResponseDto, TransitStopDto } from "@/lib/listings/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

const BOUNDS_SYNC_EPS = 0.0008;

function boundsAlmostEqual(a: ListingMapBounds, b: ListingMapBounds): boolean {
  return (
    Math.abs(a.north - b.north) < BOUNDS_SYNC_EPS &&
    Math.abs(a.south - b.south) < BOUNDS_SYNC_EPS &&
    Math.abs(a.east - b.east) < BOUNDS_SYNC_EPS &&
    Math.abs(a.west - b.west) < BOUNDS_SYNC_EPS
  );
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
  nearMetro: boolean;
  maxMetroDistanceM: number | undefined;
  maxMetroWalkMin: number | undefined;
  minTransitScore: number | undefined;
  metroLinesCsv: string;
  metroStopIdsCsv: string;
  transitModesCsv: string;
  transitMatchMode: "any" | "all";
  sort: string;
  bounds: ListingMapBounds;
}): string {
  const query = new URLSearchParams();
  query.set("page", String(params.page));
  query.set("perPage", String(params.perPage));
  query.set("source", "sreality");
  query.set("propertyType", params.propertyType || "apartment");

  if (params.q.trim()) query.set("q", params.q.trim());
  if (params.offerType) query.set("offerType", params.offerType);
  if (params.disposition.trim()) query.set("disposition", params.disposition.trim());
  if (params.minPrice != null) query.set("minPrice", String(Math.round(params.minPrice)));
  if (params.maxPrice != null) query.set("maxPrice", String(Math.round(params.maxPrice)));
  if (params.minFloorArea != null) query.set("minFloorArea", String(params.minFloorArea));
  if (params.maxFloorArea != null) query.set("maxFloorArea", String(params.maxFloorArea));
  if (params.nearMetro) query.set("nearMetro", "true");
  if (params.maxMetroDistanceM != null) query.set("maxMetroDistanceM", String(Math.round(params.maxMetroDistanceM)));
  if (params.maxMetroWalkMin != null) query.set("maxMetroWalkMin", String(Math.round(params.maxMetroWalkMin)));
  if (params.minTransitScore != null) query.set("minTransitScore", String(Math.round(params.minTransitScore)));
  if (params.metroLinesCsv.trim()) query.set("metroLines", params.metroLinesCsv.trim());
  if (params.metroStopIdsCsv.trim()) query.set("metroStopIds", params.metroStopIdsCsv.trim());
  if (params.transitModesCsv.trim()) query.set("transitModes", params.transitModesCsv.trim());
  query.set("transitMatchMode", params.transitMatchMode);

  query.set("north", String(params.bounds.north));
  query.set("south", String(params.bounds.south));
  query.set("east", String(params.bounds.east));
  query.set("west", String(params.bounds.west));

  query.set("sort", params.sort || "last_seen_desc");
  return query.toString();
}

const DEFAULT_BOUNDS: ListingMapBounds = {
  north: 50.2,
  south: 48.5,
  east: 18.9,
  west: 12.0
};

export function PortalListingsHome() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ListingCardDto[]>([]);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [debugRunning, setDebugRunning] = useState(false);
  const [debugResult, setDebugResult] = useState<string | null>(null);

  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 24,
    total: 0,
    hasNextPage: false
  });

  const [q, setQ] = useState("");
  const [offerType, setOfferType] = useState("");
  const [propertyType, setPropertyType] = useState("apartment");
  const [disposition, setDisposition] = useState("");
  const [sort, setSort] = useState("last_seen_desc");
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [minFloorArea, setMinFloorArea] = useState<number | undefined>(undefined);
  const [maxFloorArea, setMaxFloorArea] = useState<number | undefined>(undefined);
  const [nearMetro, setNearMetro] = useState(false);
  const [maxMetroDistanceM, setMaxMetroDistanceM] = useState<number | undefined>(undefined);
  const [maxMetroWalkMin, setMaxMetroWalkMin] = useState<number | undefined>(undefined);
  const [minTransitScore, setMinTransitScore] = useState<number | undefined>(undefined);
  const [metroLinesCsv, setMetroLinesCsv] = useState("");
  const [metroStopIdsCsv, setMetroStopIdsCsv] = useState("");
  const [transitModesCsv, setTransitModesCsv] = useState("");
  const [transitMatchMode, setTransitMatchMode] = useState<"any" | "all">("any");

  const [rawBounds, setRawBounds] = useState<ListingMapBounds>(DEFAULT_BOUNDS);
  const [bounds, setBounds] = useState<ListingMapBounds>(DEFAULT_BOUNDS);
  const [transitStops, setTransitStops] = useState<TransitStopDto[]>([]);
  const [showTransitOverlay, setShowTransitOverlay] = useState(isTransitMapOverlayEnabled());

  useEffect(() => {
    const timeout = setTimeout(() => {
      setBounds(rawBounds);
    }, 550);

    return () => clearTimeout(timeout);
  }, [rawBounds]);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    async function load() {
      setIsFetching(true);
      setError(null);

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      setIsAuthenticated(Boolean(token));

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
        nearMetro,
        maxMetroDistanceM,
        maxMetroWalkMin,
        minTransitScore,
        metroLinesCsv,
        metroStopIdsCsv,
        transitModesCsv,
        transitMatchMode,
        sort,
        bounds
      });

      const response = await fetch(`/api/market-listings?${qs}`, {
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!alive) return;
        setError(body.error ?? `Chyba načtení (${response.status})`);
        setInitialLoading(false);
        setIsFetching(false);
        return;
      }

      const payload = (await response.json()) as ListingSearchResponseDto;
      if (!alive) return;

      setItems(payload.items);
      setPagination(payload.pagination);
      setSelectedId((current) => (current && payload.items.some((item) => item.id === current) ? current : payload.items[0]?.id ?? null));
      setInitialLoading(false);
      setIsFetching(false);
    }

    void load().catch((err) => {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "Načtení selhalo.");
      setInitialLoading(false);
      setIsFetching(false);
    });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [
    supabase,
    page,
    q,
    offerType,
    propertyType,
    disposition,
    minPrice,
    maxPrice,
    minFloorArea,
    maxFloorArea,
    nearMetro,
    maxMetroDistanceM,
    maxMetroWalkMin,
    minTransitScore,
    metroLinesCsv,
    metroStopIdsCsv,
    transitModesCsv,
    transitMatchMode,
    sort,
    bounds
  ]);

  useEffect(() => {
    if (!showTransitOverlay) {
      setTransitStops([]);
      return;
    }

    const controller = new AbortController();
    const query = new URLSearchParams();
    query.set("north", String(bounds.north));
    query.set("south", String(bounds.south));
    query.set("east", String(bounds.east));
    query.set("west", String(bounds.west));
    query.set("mode", "metro,tram,bus,train");
    if (metroLinesCsv.trim()) {
      query.set("metroLines", metroLinesCsv.trim());
    }

    void fetch(`/api/transit/stops?${query.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { items?: TransitStopDto[] };
        setTransitStops(Array.isArray(payload.items) ? payload.items : []);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
      });

    return () => controller.abort();
  }, [showTransitOverlay, bounds, metroLinesCsv]);

  async function triggerDebugRefetch() {
    const operatorKey = process.env.NEXT_PUBLIC_OPERATOR_INGEST_KEY?.trim() ?? "";
    if (!operatorKey) {
      setDebugResult("Chybí NEXT_PUBLIC_OPERATOR_INGEST_KEY v .env.");
      return;
    }

    setDebugRunning(true);
    setDebugResult(null);

    const response = await fetch("/api/integrations/sreality/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-operator-key": operatorKey
      },
      body: JSON.stringify({ mode: "apartments_full", dryRun: false, perPage: 60 })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      runId?: string;
      error?: string;
      summary?: { fetched?: number; upserted?: number; removed?: number; failed?: number };
    };

    if (!response.ok) {
      setDebugResult(payload.error ?? `Refetch failed (${response.status}).`);
      setDebugRunning(false);
      return;
    }

    setDebugResult(
      `Run ${payload.runId ?? "?"} | fetched=${payload.summary?.fetched ?? 0} upserted=${payload.summary?.upserted ?? 0} removed=${payload.summary?.removed ?? 0} failed=${payload.summary?.failed ?? 0}`
    );

    setDebugRunning(false);
  }

  async function toggleSaved(listingId: string, nextSaved: boolean) {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      setError("Pro ukládání nabídek se prosím přihlas.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch(nextSaved ? "/api/saved-listings" : `/api/saved-listings/${listingId}`, {
      method: nextSaved ? "POST" : "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: nextSaved ? JSON.stringify({ listingId }) : undefined
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Uložení se nepodařilo.");
      setSaving(false);
      return;
    }

    setItems((current) => current.map((item) => (item.id === listingId ? { ...item, isSaved: nextSaved } : item)));
    setSaving(false);
  }

  const showMapPanel = viewMode === "map";
  const showListPanel = true;
  const splitEnabled = isSplitMapListEnabled();
  const twoColumnLayout = showMapPanel && showListPanel && splitEnabled;
  const coverageRadiusM =
    maxMetroDistanceM ??
    (maxMetroWalkMin != null && Number.isFinite(maxMetroWalkMin) ? Math.round(maxMetroWalkMin * 78) : undefined);

  return (
    <Box component="main" style={{ background: "#f4f6fb", minHeight: "100%" }}>
      <Container fluid px="md" py="lg">
        <Stack gap="lg">
          <Group justify="space-between" align="end">
            <div>
              <Title order={1} size="h2" fw={800}>
                Realitní portál
              </Title>
              <Text c="dimmed" mt={4}>
                Veřejné prohlížení + mapa a synchronizovaný seznam. Přihlášený uživatel může ukládat oblíbené.
              </Text>
            </div>
            <Stack gap={4} align="end">
              <Badge size="lg" color="blue" variant="light">
                Výsledků: {pagination.total.toLocaleString("cs-CZ")}
              </Badge>
              <Text size="xs" c={isAuthenticated ? "teal" : "dimmed"}>
                {isAuthenticated ? "Přihlášeno: ukládání aktivní" : "Anonymní režim: pouze prohlížení"}
              </Text>
            </Stack>
          </Group>

          <Card withBorder>
            <Stack gap="sm">
              <Text fw={600}>Debug panel - ruční refetch Sreality (full apartments)</Text>
              <Group align="end">
                <Button loading={debugRunning} onClick={() => void triggerDebugRefetch()}>
                  Spustit refetch
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                Používá NEXT_PUBLIC_OPERATOR_INGEST_KEY z .env (není potřeba ručně zadávat klíč).
              </Text>
              {debugResult ? (
                <Text size="sm" c={debugResult.toLowerCase().includes("failed") || debugResult.toLowerCase().includes("chyb") ? "red" : "dimmed"}>
                  {debugResult}
                </Text>
              ) : null}
            </Stack>
          </Card>

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
            nearMetro={nearMetro}
            setNearMetro={setNearMetro}
            maxMetroDistanceM={maxMetroDistanceM}
            setMaxMetroDistanceM={setMaxMetroDistanceM}
            maxMetroWalkMin={maxMetroWalkMin}
            setMaxMetroWalkMin={setMaxMetroWalkMin}
            minTransitScore={minTransitScore}
            setMinTransitScore={setMinTransitScore}
            metroLinesCsv={metroLinesCsv}
            setMetroLinesCsv={setMetroLinesCsv}
            metroStopIdsCsv={metroStopIdsCsv}
            setMetroStopIdsCsv={setMetroStopIdsCsv}
            transitModesCsv={transitModesCsv}
            setTransitModesCsv={setTransitModesCsv}
            transitMatchMode={transitMatchMode}
            setTransitMatchMode={setTransitMatchMode}
            currentPage={pagination.page}
            currentCount={items.length}
            onChangePageToFirst={() => setPage(1)}
            onReset={() => {
              setPage(1);
              setQ("");
              setOfferType("");
              setPropertyType("apartment");
              setDisposition("");
              setSort("last_seen_desc");
              setMinPrice(undefined);
              setMaxPrice(undefined);
              setMinFloorArea(undefined);
              setMaxFloorArea(undefined);
              setNearMetro(false);
              setMaxMetroDistanceM(undefined);
              setMaxMetroWalkMin(undefined);
              setMinTransitScore(undefined);
              setMetroLinesCsv("");
              setMetroStopIdsCsv("");
              setTransitModesCsv("");
              setTransitMatchMode("any");
              setRawBounds(DEFAULT_BOUNDS);
            }}
          />

          {error ? <Text c="red">{error}</Text> : null}
          {saving ? <Text size="xs" c="dimmed">Ukládám změny oblíbených...</Text> : null}

          <SegmentedControl
            fullWidth
            value={viewMode}
            onChange={(value) => setViewMode(value as "map" | "list")}
            data={[
              { value: "map", label: "Mapa + seznam" },
              { value: "list", label: "Pouze seznam" }
            ]}
          />

          {initialLoading ? (
            <Group justify="center" py="xl">
              <Loader size="lg" />
            </Group>
          ) : (
            <Stack gap="sm">
              {isFetching ? (
                <Text size="sm" c="dimmed">Aktualizuji vysledky podle mapy a filtru...</Text>
              ) : null}

              <SimpleGrid cols={{ base: 1, lg: twoColumnLayout ? 2 : 1 }} spacing="md">
              {showMapPanel ? (
                <ListingMapPanel
                  items={items}
                  transitStops={transitStops}
                  showTransitOverlay={showTransitOverlay}
                  onToggleTransitOverlay={setShowTransitOverlay}
                  coverageRadiusM={coverageRadiusM}
                  bounds={rawBounds}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onApplyBounds={(next) => {
                    if (boundsAlmostEqual(rawBounds, next)) return;
                    if (page !== 1) {
                      setPage(1);
                    }
                    setRawBounds(next);
                  }}
                />
              ) : null}

              {showListPanel ? (
                <Box pos="relative">
                  {isFetching ? (
                    <Box
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(255,255,255,0.35)",
                        backdropFilter: "blur(1px)",
                        borderRadius: 8,
                        zIndex: 2,
                        pointerEvents: "none"
                      }}
                    />
                  ) : null}

                  <ListingResultsPanel
                    items={items}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onToggleSaved={toggleSaved}
                    layout={showMapPanel ? "mapGrid" : "listGrid"}
                    hasActiveTransitFilters={
                      nearMetro ||
                      maxMetroDistanceM != null ||
                      maxMetroWalkMin != null ||
                      minTransitScore != null ||
                      metroLinesCsv.trim().length > 0 ||
                      metroStopIdsCsv.trim().length > 0 ||
                      transitModesCsv.trim().length > 0
                    }
                  />

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
                </Box>
              ) : null}
            </SimpleGrid>
            </Stack>
          )}
        </Stack>
      </Container>
    </Box>
  );
}


