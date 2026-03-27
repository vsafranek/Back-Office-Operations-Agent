"use client";

import { useEffect, useState } from "react";
import type { AgentMarketListingCard } from "@/lib/agent/types";
import { MarketListingCardView } from "@/components/agent/MarketListingCardView";

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
};

function mapApiListing(row: {
  external_id: string;
  title: string;
  location: string;
  source: string;
  url: string;
  image_url?: string;
}): AgentMarketListingCard {
  return {
    external_id: row.external_id,
    title: row.title,
    location: row.location,
    source: row.source,
    url: row.url,
    ...(row.image_url ? { image_url: row.image_url } : {})
  };
}

/**
 * Pravý panel: zavolá POST /api/market-listings podle fetchParams z agenta a vykreslí karty.
 */
export function MarketListingsDataPanelSection({ title, fetchParams, initialListings, getAccessToken }: Props) {
  const [listings, setListings] = useState<AgentMarketListingCard[]>(initialListings);
  const [loading, setLoading] = useState(Boolean(fetchParams && Object.keys(fetchParams).length > 0));
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div style={panelChrome}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
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
        {loading ? "Načítám nabídky…" : error ? `Chyba: ${error}` : `${listings.length} nabídek · karty z API`}
      </p>
      {error && !loading ? (
        <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>{error}</p>
      ) : null}
      {!loading && listings.length === 0 && !error ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Žádné záznamy k zobrazení.</p>
      ) : null}
      {listings.length > 0 ? (
        <div style={{ display: "grid", gap: 14 }}>
          {listings.map((c) => (
            <MarketListingCardView key={c.external_id} card={c} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
