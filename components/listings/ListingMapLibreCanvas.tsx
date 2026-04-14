"use client";

import maplibregl, { type LngLatBoundsLike } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";

import type { ListingCardDto, ListingMapBounds } from "@/lib/listings/types";

type MapPoint = {
  id: string;
  title: string;
  locality: string;
  sourceUrl: string;
  currency: string;
  priceAmount: number | null;
  lat: number;
  lng: number;
};

type ListingMapLibreCanvasProps = {
  items: ListingCardDto[];
  selectedId: string | null;
  bounds: ListingMapBounds;
  onSelect: (listingId: string | null) => void;
  onBoundsChange: (bounds: ListingMapBounds) => void;
};

const EPS = 0.0005;
const BOUNDS_EMIT_DEBOUNCE_MS = 420;

function makePriceLabel(priceAmount: number | null): string {
  return priceAmount == null ? "N/A" : `${Math.round(priceAmount / 1000)} tis.`;
}

function toBoundsLike(bounds: ListingMapBounds): LngLatBoundsLike {
  return [
    [bounds.west, bounds.south],
    [bounds.east, bounds.north]
  ];
}

function closeEnough(a: ListingMapBounds, b: ListingMapBounds): boolean {
  return (
    Math.abs(a.north - b.north) < EPS &&
    Math.abs(a.south - b.south) < EPS &&
    Math.abs(a.east - b.east) < EPS &&
    Math.abs(a.west - b.west) < EPS
  );
}

function mapyRasterStyle(apiKey: string): maplibregl.StyleSpecification {
  const tileUrl = `https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${encodeURIComponent(apiKey)}&lang=cs`;

  return {
    version: 8,
    sources: {
      mapy: {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        attribution: "© Seznam.cz a.s. a přispěvatelé OpenStreetMap"
      }
    },
    layers: [
      {
        id: "mapy-raster",
        type: "raster",
        source: "mapy",
        minzoom: 0,
        maxzoom: 19
      }
    ]
  };
}

function applyMarkerVisualState(button: HTMLButtonElement, selected: boolean): void {
  button.style.background = selected ? "#1971c2" : "#ffffff";
  button.style.color = selected ? "#ffffff" : "#1f2937";
  button.style.border = `1px solid ${selected ? "#1971c2" : "#d0d7e2"}`;
}

export function ListingMapLibreCanvas({ items, selectedId, bounds, onSelect, onBoundsChange }: ListingMapLibreCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const markerButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const suppressMoveEventRef = useRef(false);
  const lastFromMapRef = useRef<ListingMapBounds | null>(null);
  const boundsEmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);
  const initialBoundsRef = useRef(bounds);

  const points = useMemo<MapPoint[]>(
    () =>
      items
        .filter((item) => item.latitude != null && item.longitude != null)
        .map((item) => ({
          id: item.id,
          title: item.title,
          locality: item.locality,
          sourceUrl: item.sourceUrl,
          currency: item.currency,
          priceAmount: item.priceAmount,
          lat: item.latitude as number,
          lng: item.longitude as number
        })),
    [items]
  );

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_MAPY_API_KEY?.trim();
    if (!containerRef.current || mapRef.current || !apiKey) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapyRasterStyle(apiKey),
      bounds: toBoundsLike(initialBoundsRef.current),
      fitBoundsOptions: { padding: 20, duration: 0 }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("moveend", () => {
      if (suppressMoveEventRef.current) {
        suppressMoveEventRef.current = false;
        return;
      }

      const b = map.getBounds();
      const nextBounds: ListingMapBounds = {
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest()
      };

      if (lastFromMapRef.current && closeEnough(lastFromMapRef.current, nextBounds)) {
        return;
      }

      if (boundsEmitTimerRef.current) {
        clearTimeout(boundsEmitTimerRef.current);
      }

      boundsEmitTimerRef.current = setTimeout(() => {
        if (lastFromMapRef.current && closeEnough(lastFromMapRef.current, nextBounds)) {
          return;
        }
        lastFromMapRef.current = nextBounds;
        onBoundsChangeRef.current(nextBounds);
      }, BOUNDS_EMIT_DEBOUNCE_MS);
    });

    mapRef.current = map;

    return () => {
      if (boundsEmitTimerRef.current) {
        clearTimeout(boundsEmitTimerRef.current);
        boundsEmitTimerRef.current = null;
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      markerButtonsRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const b = map.getBounds();
    const currentBounds: ListingMapBounds = {
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest()
    };

    if (closeEnough(currentBounds, bounds)) return;
    if (lastFromMapRef.current && closeEnough(lastFromMapRef.current, bounds)) return;

    suppressMoveEventRef.current = true;
    map.fitBounds(toBoundsLike(bounds), { padding: 20, duration: 0 });
  }, [bounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    markerButtonsRef.current.clear();

    for (const point of points) {
      const button = document.createElement("button");
      button.type = "button";
      button.style.borderRadius = "999px";
      button.style.padding = "4px 8px";
      button.style.fontSize = "12px";
      button.style.fontWeight = "700";
      button.style.whiteSpace = "nowrap";
      button.style.boxShadow = "0 3px 12px rgba(0,0,0,0.15)";
      button.style.cursor = "pointer";
      button.textContent = makePriceLabel(point.priceAmount);
      applyMarkerVisualState(button, selectedId === point.id);
      button.onclick = () => {
        const nextSelection = selectedIdRef.current === point.id ? null : point.id;
        onSelectRef.current(nextSelection);
      };

      const marker = new maplibregl.Marker({ element: button, anchor: "center" }).setLngLat([point.lng, point.lat]).addTo(map);

      markersRef.current.push(marker);
      markerButtonsRef.current.set(point.id, button);
    }
  }, [points]);

  useEffect(() => {
    for (const [pointId, button] of markerButtonsRef.current.entries()) {
      applyMarkerVisualState(button, selectedId === pointId);
    }
  }, [selectedId]);

  if (!process.env.NEXT_PUBLIC_MAPY_API_KEY?.trim()) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          color: "#64748b",
          padding: 16,
          textAlign: "center"
        }}
      >
        Chybí NEXT_PUBLIC_MAPY_API_KEY. Doplň API klíč pro mapové podklady Mapy.com.
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

