"use client";

import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

type ListingDetailNeighborhoodMapProps = {
  latitude: number;
  longitude: number;
  title: string;
};

function mapyRasterStyle(apiKey: string): maplibregl.StyleSpecification {
  const tileUrl = `https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${encodeURIComponent(apiKey)}&lang=cs`;
  return {
    version: 8,
    sources: {
      mapy: {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        attribution: "© Seznam.cz a.s. a prispivatele OpenStreetMap"
      }
    },
    layers: [
      {
        id: "mapy-raster",
        type: "raster",
        source: "mapy"
      }
    ]
  };
}

export function ListingDetailNeighborhoodMap({ latitude, longitude, title }: ListingDetailNeighborhoodMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_MAPY_API_KEY?.trim();
    if (!containerRef.current || mapRef.current || !apiKey) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapyRasterStyle(apiKey),
      center: [longitude, latitude],
      zoom: 15
    });
    map.scrollZoom.disable();
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    const markerElement = document.createElement("div");
    markerElement.style.width = "14px";
    markerElement.style.height = "14px";
    markerElement.style.borderRadius = "999px";
    markerElement.style.background = "#1d4ed8";
    markerElement.style.border = "2px solid #ffffff";
    markerElement.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)";
    markerElement.title = title;

    const marker = new maplibregl.Marker({ element: markerElement, anchor: "center" })
      .setLngLat([longitude, latitude])
      .addTo(map);

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      marker.remove();
      map.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [latitude, longitude, title]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.jumpTo({ center: [longitude, latitude], zoom: 15 });
    markerRef.current?.setLngLat([longitude, latitude]);
  }, [latitude, longitude]);

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
        Chybi NEXT_PUBLIC_MAPY_API_KEY pro mapovy nahled.
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
