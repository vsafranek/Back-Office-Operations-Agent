"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

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

type ListingLeafletCanvasProps = {
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

function asLeafletBounds(bounds: ListingMapBounds): L.LatLngBoundsExpression {
  return [
    [bounds.south, bounds.west],
    [bounds.north, bounds.east]
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

function markerIcon(label: string, selected: boolean): L.DivIcon {
  const bg = selected ? "#1971c2" : "#ffffff";
  const color = selected ? "#ffffff" : "#1f2937";
  const border = selected ? "#1971c2" : "#d0d7e2";

  return L.divIcon({
    className: "portal-price-marker",
    html: `<div style="background:${bg};color:${color};border:1px solid ${border};border-radius:999px;padding:4px 8px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 3px 12px rgba(0,0,0,0.15)">${label}</div>`,
    iconSize: [72, 28],
    iconAnchor: [36, 14]
  });
}

function BoundsController({ bounds, onBoundsChange }: { bounds: ListingMapBounds; onBoundsChange: (bounds: ListingMapBounds) => void }) {
  const map = useMap();
  const lastFromMap = useRef<ListingMapBounds | null>(null);

  useEffect(() => {
    const current = map.getBounds();
    const currentBounds: ListingMapBounds = {
      north: current.getNorth(),
      south: current.getSouth(),
      east: current.getEast(),
      west: current.getWest()
    };

    if (closeEnough(currentBounds, bounds)) return;
    if (lastFromMap.current && closeEnough(lastFromMap.current, bounds)) return;

    map.fitBounds(asLeafletBounds(bounds), { animate: false, padding: [20, 20] });
  }, [map, bounds]);

  useMapEvents({
    moveend() {
      const next = map.getBounds();
      const nextBounds: ListingMapBounds = {
        north: next.getNorth(),
        south: next.getSouth(),
        east: next.getEast(),
        west: next.getWest()
      };
      lastFromMap.current = nextBounds;
      onBoundsChange(nextBounds);
    }
  });

  return null;
}

export function ListingLeafletCanvas({ items, selectedId, bounds, onSelect, onBoundsChange }: ListingLeafletCanvasProps) {
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

  return (
    <MapContainer bounds={asLeafletBounds(bounds)} style={{ width: "100%", height: "100%" }} scrollWheelZoom>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <BoundsController bounds={bounds} onBoundsChange={onBoundsChange} />

      {points.map((point) => {
        const selected = selectedId === point.id;
        const label = point.priceAmount == null ? "N/A" : `${Math.round(point.priceAmount / 1000)} tis.`;

        return (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={markerIcon(label, selected)}
            eventHandlers={{
              click: () => {
                onSelect(point.id);
              }
            }}
          >
            <Popup>
              <div style={{ minWidth: 220, maxWidth: 260 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{point.title}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>{point.locality}</div>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>{formatPrice(point.priceAmount, point.currency)}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={`/listing/${point.id}`} style={{ fontSize: 12, color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}>
                    Detail
                  </a>
                  <a href={point.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}>
                    Originál
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
