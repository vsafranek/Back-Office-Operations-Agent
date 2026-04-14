"use client";

import maplibregl, { type LngLatBoundsLike, type Popup } from "maplibre-gl";
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
  onSelect: (listingId: string) => void;
  onBoundsChange: (bounds: ListingMapBounds) => void;
};

const EPS = 0.0005;

function formatPrice(value: number | null, currency: string): string {
  if (value == null) return "Cena na dotaz";
  return `${value.toLocaleString("cs-CZ")} ${currency}`;
}

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

function buildPopupDom(point: MapPoint): HTMLDivElement {
  const root = document.createElement("div");
  root.style.minWidth = "220px";
  root.style.maxWidth = "260px";

  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.style.marginBottom = "4px";
  title.textContent = point.title;

  const locality = document.createElement("div");
  locality.style.color = "#64748b";
  locality.style.fontSize = "12px";
  locality.style.marginBottom = "8px";
  locality.textContent = point.locality;

  const price = document.createElement("div");
  price.style.fontWeight = "700";
  price.style.marginBottom = "10px";
  price.textContent = formatPrice(point.priceAmount, point.currency);

  const links = document.createElement("div");
  links.style.display = "flex";
  links.style.gap = "8px";

  const detailLink = document.createElement("a");
  detailLink.href = `/listing/${point.id}`;
  detailLink.style.fontSize = "12px";
  detailLink.style.color = "#1d4ed8";
  detailLink.style.textDecoration = "none";
  detailLink.style.fontWeight = "600";
  detailLink.textContent = "Detail";

  const sourceLink = document.createElement("a");
  sourceLink.href = point.sourceUrl;
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener noreferrer";
  sourceLink.style.fontSize = "12px";
  sourceLink.style.color = "#1d4ed8";
  sourceLink.style.textDecoration = "none";
  sourceLink.style.fontWeight = "600";
  sourceLink.textContent = "Originál";

  links.appendChild(detailLink);
  links.appendChild(sourceLink);

  root.appendChild(title);
  root.appendChild(locality);
  root.appendChild(price);
  root.appendChild(links);

  return root;
}

export function ListingMapLibreCanvas({ items, selectedId, bounds, onSelect, onBoundsChange }: ListingMapLibreCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const suppressMoveEventRef = useRef(false);
  const lastFromMapRef = useRef<ListingMapBounds | null>(null);

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
    const apiKey = process.env.NEXT_PUBLIC_MAPY_API_KEY?.trim();
    if (!containerRef.current || mapRef.current || !apiKey) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapyRasterStyle(apiKey),
      bounds: toBoundsLike(bounds),
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

      lastFromMapRef.current = nextBounds;
      onBoundsChange(nextBounds);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [bounds, onBoundsChange]);

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

    for (const point of points) {
      const selected = selectedId === point.id;

      const button = document.createElement("button");
      button.type = "button";
      button.style.background = selected ? "#1971c2" : "#ffffff";
      button.style.color = selected ? "#ffffff" : "#1f2937";
      button.style.border = `1px solid ${selected ? "#1971c2" : "#d0d7e2"}`;
      button.style.borderRadius = "999px";
      button.style.padding = "4px 8px";
      button.style.fontSize = "12px";
      button.style.fontWeight = "700";
      button.style.whiteSpace = "nowrap";
      button.style.boxShadow = "0 3px 12px rgba(0,0,0,0.15)";
      button.style.cursor = "pointer";
      button.textContent = makePriceLabel(point.priceAmount);
      button.onclick = () => onSelect(point.id);

      const popup: Popup = new maplibregl.Popup({ offset: 12 }).setDOMContent(buildPopupDom(point));

      const marker = new maplibregl.Marker({ element: button, anchor: "center" })
        .setLngLat([point.lng, point.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [points, selectedId, onSelect]);

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

