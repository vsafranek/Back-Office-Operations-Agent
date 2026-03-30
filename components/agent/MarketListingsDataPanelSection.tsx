"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Group, Paper, Select, Stack, Text, TextInput } from "@mantine/core";
import type { AgentMarketListingCard } from "@/lib/agent/types";
import { MarketListingCardView } from "@/components/agent/MarketListingCardView";

/** Horní mez šířky karty — užší sloupce = více karet vedle sebe v panelu chatu. */
const CHAT_MARKET_LISTING_CARD_MAX_WIDTH_PX = 220;

const panelChrome = {
  position: "sticky" as const,
  top: 12,
  display: "grid" as const,
  gap: 20,
  alignContent: "start" as const,
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 14,
  background: "#fafafa",
  maxHeight: "calc(100vh - 48px)",
  overflow: "auto" as const
};

type Props = {
  title: string;
  fetchParams?: Record<string, unknown>;
  initialListings: AgentMarketListingCard[];
  getAccessToken?: () => Promise<string | null>;
  /** Použije filtry + stránkování nad výsledkem (pro záložku Z běhu agenta). */
  enableClientFiltersAndPagination?: boolean;
  /** Bez vnějšího card/sticky wrapperu a bez nadpisu komponenty. */
  embedded?: boolean;
};

function mapApiListing(row: {
  external_id: string;
  title: string;
  location: string;
  source: string;
  url: string;
  image_url?: string;
  price_czk?: number | null;
}): AgentMarketListingCard {
  return {
    external_id: row.external_id,
    title: row.title,
    location: row.location,
    source: row.source,
    url: row.url,
    ...(row.image_url ? { image_url: row.image_url } : {}),
    ...(typeof row.price_czk === "number" ? { price_czk: row.price_czk } : {})
  };
}

/**
 * Pravý panel: zavolá POST /api/market-listings podle fetchParams z agenta a vykreslí karty.
 */
export function MarketListingsDataPanelSection({
  title,
  fetchParams,
  initialListings,
  getAccessToken,
  enableClientFiltersAndPagination = false,
  embedded = false
}: Props) {
  const [listings, setListings] = useState<AgentMarketListingCard[]>(initialListings);
  const [loading, setLoading] = useState(Boolean(fetchParams && Object.keys(fetchParams).length > 0));
  const [error, setError] = useState<string | null>(null);
  const pageSize = 12;
  const [page, setPage] = useState(1);
  const [draftLocation, setDraftLocation] = useState("");
  const [draftSource, setDraftSource] = useState<"" | "sreality" | "bezrealitky">("");
  const [draftPriceMin, setDraftPriceMin] = useState("");
  const [draftPriceMax, setDraftPriceMax] = useState("");
  const [appliedLocation, setAppliedLocation] = useState("");
  const [appliedSource, setAppliedSource] = useState<"" | "sreality" | "bezrealitky">("");
  const [appliedPriceMin, setAppliedPriceMin] = useState("");
  const [appliedPriceMax, setAppliedPriceMax] = useState("");

  const paramsKey = fetchParams ? JSON.stringify(fetchParams) : "";

  useEffect(() => {
    if (!fetchParams || Object.keys(fetchParams).length === 0) {
      setListings(initialListings);
      setLoading(false);
      setError(null);
    }
  }, [fetchParams, initialListings]);

  useEffect(() => {
    if (!fetchParams || Object.keys(fetchParams).length === 0) {
      return;
    }

    let cancelled = false;

    async function run() {
      const token = getAccessToken ? await getAccessToken() : null;
      if (!token) {
        setError("Pro načtení nabídek je potřeba být přihlášen.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/market-listings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(fetchParams)
        });
        const payload = (await res.json().catch(() => ({}))) as { listings?: unknown; error?: string };
        if (!res.ok) {
          throw new Error(payload.error ?? `HTTP ${res.status}`);
        }
        const raw = payload.listings;
        if (!Array.isArray(raw)) {
          throw new Error("Neočekávaná odpověď API.");
        }
        if (!cancelled) {
          setListings(raw.map((x) => mapApiListing(x as Parameters<typeof mapApiListing>[0])));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Chyba načtení");
          setListings([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [paramsKey, fetchParams, getAccessToken]);

  useEffect(() => {
    setPage(1);
  }, [listings.length, appliedLocation, appliedSource, appliedPriceMin, appliedPriceMax]);

  async function handleRefresh() {
    if (!fetchParams || Object.keys(fetchParams).length === 0) return;
    const token = getAccessToken ? await getAccessToken() : null;
    if (!token) {
      setError("Pro načtení nabídek je potřeba být přihlášen.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/market-listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(fetchParams)
      });
      const payload = (await res.json().catch(() => ({}))) as { listings?: unknown; error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      const raw = payload.listings;
      if (!Array.isArray(raw)) {
        throw new Error("Neočekávaná odpověď API.");
      }
      setListings(raw.map((x) => mapApiListing(x as Parameters<typeof mapApiListing>[0])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba načtení");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    setAppliedLocation(draftLocation.trim());
    setAppliedSource(draftSource);
    setAppliedPriceMin(draftPriceMin.trim());
    setAppliedPriceMax(draftPriceMax.trim());
    setPage(1);
  }

  function resetFilters() {
    setDraftLocation("");
    setDraftSource("");
    setDraftPriceMin("");
    setDraftPriceMax("");
    setAppliedLocation("");
    setAppliedSource("");
    setAppliedPriceMin("");
    setAppliedPriceMax("");
    setPage(1);
  }

  const filteredListings = useMemo(() => {
    if (!enableClientFiltersAndPagination) return listings;
    const qLoc = appliedLocation.toLowerCase();
    const pMin = parseInt(appliedPriceMin, 10);
    const pMax = parseInt(appliedPriceMax, 10);
    const hasMin = Number.isFinite(pMin);
    const hasMax = Number.isFinite(pMax);
    return listings.filter((l) => {
      if (qLoc) {
        const hay = `${l.title} ${l.location}`.toLowerCase();
        if (!hay.includes(qLoc)) return false;
      }
      if (appliedSource && l.source.toLowerCase() !== appliedSource) return false;
      if (hasMin || hasMax) {
        if (typeof l.price_czk !== "number") return false;
        if (hasMin && l.price_czk < pMin) return false;
        if (hasMax && l.price_czk > pMax) return false;
      }
      return true;
    });
  }, [
    listings,
    enableClientFiltersAndPagination,
    appliedLocation,
    appliedSource,
    appliedPriceMin,
    appliedPriceMax
  ]);

  const total = filteredListings.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize;
  const visibleListings = enableClientFiltersAndPagination ? filteredListings.slice(from, to) : listings;
  const rangeStart = total === 0 ? 0 : from + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(to, total);
  const filtersActive =
    Boolean(appliedLocation) ||
    Boolean(appliedSource) ||
    Boolean(appliedPriceMin) ||
    Boolean(appliedPriceMax);

  return (
    <div style={embedded ? { display: "grid", gap: 12 } : panelChrome}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        {!embedded ? <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2> : <span />}
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={loading || !fetchParams || Object.keys(fetchParams).length === 0}
          style={{
            fontSize: 13,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#fff",
            cursor: loading || !fetchParams || Object.keys(fetchParams).length === 0 ? "not-allowed" : "pointer"
          }}
        >
          Obnovit
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
        {loading
          ? "Načítám nabídky…"
          : error
            ? `Chyba: ${error}`
            : enableClientFiltersAndPagination
              ? `Uloženo celkem: ${listings.length}${filtersActive ? " (podle filtru níže)" : ""}`
              : `${listings.length} nabídek · karty z API`}
      </p>
      {error && !loading ? (
        <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>{error}</p>
      ) : null}
      {!loading && listings.length === 0 && !error ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Žádné záznamy k zobrazení.</p>
      ) : null}
      {enableClientFiltersAndPagination ? (
        <Paper withBorder p="xs" radius="sm">
          <Stack gap="xs">
            <Text size="xs" fw={600}>
              Filtry
            </Text>
            <Text size="xs" c="dimmed">
              Cena filtruje jen nabídky s cenou. Lokalita hledá část textu v názvu a lokaci.
            </Text>
            <Group grow align="flex-end" wrap="wrap" gap="xs">
              <TextInput
                label="Lokalita"
                placeholder="např. Holešovice"
                size="xs"
                value={draftLocation}
                onChange={(e) => setDraftLocation(e.currentTarget.value)}
              />
              <Select
                label="Realitka"
                placeholder="Všechny"
                size="xs"
                clearable
                data={[
                  { value: "sreality", label: "Sreality" },
                  { value: "bezrealitky", label: "Bezrealitky" }
                ]}
                value={draftSource || null}
                onChange={(v) => setDraftSource((v as "" | "sreality" | "bezrealitky" | null) ?? "")}
              />
              <TextInput
                label="Cena od (Kč)"
                placeholder="např. 3000000"
                size="xs"
                inputMode="numeric"
                value={draftPriceMin}
                onChange={(e) => setDraftPriceMin(e.currentTarget.value.replace(/\D/g, ""))}
              />
              <TextInput
                label="Cena do (Kč)"
                placeholder="např. 8000000"
                size="xs"
                inputMode="numeric"
                value={draftPriceMax}
                onChange={(e) => setDraftPriceMax(e.currentTarget.value.replace(/\D/g, ""))}
              />
            </Group>
            <Group gap="xs">
              <Button size="compact-xs" onClick={applyFilters}>
                Použít filtry
              </Button>
              <Button size="compact-xs" variant="default" onClick={resetFilters}>
                Zrušit filtry
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              Zobrazeno {rangeStart}–{rangeEnd} z {total}.
            </Text>
          </Stack>
        </Paper>
      ) : null}
      {visibleListings.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, 140px), ${CHAT_MARKET_LISTING_CARD_MAX_WIDTH_PX}px))`,
            gap: 12,
            justifyContent: "start",
            alignItems: "start",
            minWidth: 0
          }}
        >
          {visibleListings.map((c) => (
            <div
              key={c.external_id}
              style={{
                maxWidth: CHAT_MARKET_LISTING_CARD_MAX_WIDTH_PX,
                width: "100%",
                minWidth: 0
              }}
            >
              <MarketListingCardView card={c} maxWidthPx={CHAT_MARKET_LISTING_CARD_MAX_WIDTH_PX} />
              {typeof c.price_czk === "number" ? (
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: "#1e293b" }}>
                  {c.price_czk.toLocaleString("cs-CZ")} Kč
                </div>
              ) : (
                <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>Cena není k dispozici</div>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {enableClientFiltersAndPagination && totalPages > 1 ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: safePage <= 1 ? "not-allowed" : "pointer"
            }}
          >
            ← Předchozí
          </button>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Stránka {safePage} / {totalPages}
          </div>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: safePage >= totalPages ? "not-allowed" : "pointer"
            }}
          >
            Další →
          </button>
        </div>
      ) : null}
    </div>
  );
}
