"use client";

import maplibregl, { type LngLatBoundsLike } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";

import type { ListingCardDto, ListingMapBounds, TransitRouteDto, TransitStopDto } from "@/lib/listings/types";

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
  transitStops: TransitStopDto[];
  metroRoutes: TransitRouteDto[];
  showListingMarkers: boolean;
  showTransitStops: boolean;
  showMetroRoutes: boolean;
  showCoverage: boolean;
  coverageRadiusM?: number;
  selectedId: string | null;
  bounds: ListingMapBounds;
  onSelect: (listingId: string | null) => void;
  onBoundsChange: (bounds: ListingMapBounds) => void;
};

const EPS = 0.0005;
const BOUNDS_EMIT_DEBOUNCE_MS = 140;
const TRANSIT_STOP_MARKER_MIN_ZOOM = 12;
const TRANSIT_STOP_LABEL_MIN_ZOOM = 13;
const METRO_LINE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#facc15",
  C: "#ef4444",
  D: "#3b82f6"
};
const TRANSIT_MODE_VISUALS: Record<
  TransitStopDto["mode"],
  { color: string; chip: string; title: string }
> = {
  metro: { color: "#1d4ed8", chip: "M", title: "Metro" },
  tram: { color: "#16a34a", chip: "T", title: "Tramvaj" },
  bus: { color: "#f59e0b", chip: "B", title: "Bus" },
  train: { color: "#7c3aed", chip: "V", title: "Vlak" }
};

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

function stopLabel(stop: TransitStopDto): string {
  const line = stop.metroLine?.trim().toUpperCase();
  if (stop.mode === "metro" && line) {
    return `${stop.name} (M${line})`;
  }
  return stop.name;
}

function applyTransitLabelVisibility(labels: HTMLSpanElement[], zoom: number): void {
  const showLabels = zoom >= TRANSIT_STOP_LABEL_MIN_ZOOM;
  for (const label of labels) {
    label.style.display = showLabels ? "inline" : "none";
  }
}

function applyTransitMarkerVisibility(markers: HTMLDivElement[], zoom: number): void {
  const showMarkers = zoom >= TRANSIT_STOP_MARKER_MIN_ZOOM;
  for (const marker of markers) {
    marker.style.display = showMarkers ? "flex" : "none";
  }
}

export function ListingMapLibreCanvas({
  items,
  transitStops,
  metroRoutes,
  showListingMarkers,
  showTransitStops,
  showMetroRoutes,
  showCoverage,
  coverageRadiusM = 0,
  selectedId,
  bounds,
  onSelect,
  onBoundsChange
}: ListingMapLibreCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const transitMarkersRef = useRef<maplibregl.Marker[]>([]);
  const transitMarkerElementsRef = useRef<HTMLDivElement[]>([]);
  const transitLabelElementsRef = useRef<Array<{ label: HTMLSpanElement; mode: TransitStopDto["mode"] }>>([]);
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

    map.on("move", () => {
      if (suppressMoveEventRef.current) {
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
      transitMarkersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      transitMarkersRef.current = [];
      transitMarkerElementsRef.current = [];
      transitLabelElementsRef.current = [];
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
    map.once("moveend", () => {
      suppressMoveEventRef.current = false;
    });
    map.fitBounds(toBoundsLike(bounds), { padding: 20, duration: 0 });
  }, [bounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    markerButtonsRef.current.clear();
    if (!showListingMarkers) return;

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
  }, [points, showListingMarkers]);

  useEffect(() => {
    for (const [pointId, button] of markerButtonsRef.current.entries()) {
      applyMarkerVisualState(button, selectedId === pointId);
    }
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const coverageSourceId = "transit-coverage-source";
    const coverageLayerId = "transit-coverage-layer";
    const routesSourceId = "metro-routes-source";
    const routesLayerId = "metro-routes-layer";

    const renderTransitLayers = () => {
      transitMarkersRef.current.forEach((m) => m.remove());
      transitMarkersRef.current = [];
      transitMarkerElementsRef.current = [];
      transitLabelElementsRef.current = [];

      const hasCoverageSource = Boolean(map.getSource(coverageSourceId));
      const hasRoutesSource = Boolean(map.getSource(routesSourceId));
      if (map.getLayer(coverageLayerId)) map.removeLayer(coverageLayerId);
      if (map.getLayer(routesLayerId)) map.removeLayer(routesLayerId);
      if (hasCoverageSource) map.removeSource(coverageSourceId);
      if (hasRoutesSource) map.removeSource(routesSourceId);

      const visibleStops = transitStops.filter((stop) => showTransitStops || (showMetroRoutes && stop.mode === "metro"));

      if (visibleStops.length > 0) {
        for (const stop of visibleStops) {
          const metroLine = stop.metroLine?.trim().toUpperCase() ?? null;
          const modeVisual = TRANSIT_MODE_VISUALS[stop.mode];
          const modeColor = stop.mode === "metro" && metroLine ? METRO_LINE_COLORS[metroLine] ?? modeVisual.color : modeVisual.color;

          const markerRoot = document.createElement("div");
          markerRoot.style.display = "flex";
          markerRoot.style.alignItems = "center";
          markerRoot.style.gap = "6px";
          markerRoot.style.padding = "3px 7px 3px 4px";
          markerRoot.style.borderRadius = "999px";
          markerRoot.style.border = "1px solid rgba(15, 23, 42, 0.2)";
          markerRoot.style.background = "rgba(255, 255, 255, 0.93)";
          markerRoot.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
          markerRoot.style.backdropFilter = "blur(2px)";
          transitMarkerElementsRef.current.push(markerRoot);

          const chip = document.createElement("span");
          chip.textContent = modeVisual.chip;
          chip.style.display = "inline-flex";
          chip.style.alignItems = "center";
          chip.style.justifyContent = "center";
          chip.style.minWidth = "18px";
          chip.style.height = "18px";
          chip.style.padding = "0 5px";
          chip.style.borderRadius = "999px";
          chip.style.fontSize = "10px";
          chip.style.fontWeight = "800";
          chip.style.lineHeight = "1";
          chip.style.color = "#ffffff";
          chip.style.background = modeColor;

          const label = document.createElement("span");
          label.textContent = stopLabel(stop);
          label.style.fontSize = "11px";
          label.style.fontWeight = "700";
          label.style.color = "#0f172a";
          label.style.lineHeight = "1.1";
          label.style.maxWidth = "168px";
          label.style.whiteSpace = "nowrap";
          label.style.overflow = "hidden";
          label.style.textOverflow = "ellipsis";
          transitLabelElementsRef.current.push({ label, mode: stop.mode });

          markerRoot.title = `${modeVisual.title}: ${stopLabel(stop)}`;
          markerRoot.append(chip, label);

          const marker = new maplibregl.Marker({ element: markerRoot, anchor: "left" })
            .setLngLat([stop.longitude, stop.latitude])
            .addTo(map);

          transitMarkersRef.current.push(marker);
        }
        applyTransitMarkerVisibility(transitMarkerElementsRef.current, map.getZoom());
        const showLabels = map.getZoom() >= TRANSIT_STOP_LABEL_MIN_ZOOM;
        for (const { label, mode } of transitLabelElementsRef.current) {
          const allowMetroLabel = mode !== "metro" || showMetroRoutes;
          label.style.display = showLabels && allowMetroLabel ? "inline" : "none";
        }
      }

      if (showMetroRoutes && metroRoutes.length > 0) {
        map.addSource(routesSourceId, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: metroRoutes
              .filter((route) => route.points.length >= 2)
              .map((route) => ({
                type: "Feature" as const,
                geometry: {
                  type: "LineString" as const,
                  coordinates: route.points.map((point) => [point.longitude, point.latitude])
                },
                properties: {
                  line: route.line,
                  color: route.color
                }
              }))
          }
        });

        map.addLayer({
          id: routesLayerId,
          type: "line",
          source: routesSourceId,
          paint: {
            "line-color": ["coalesce", ["get", "color"], "#2563eb"],
            "line-width": 3.2,
            "line-opacity": 0.85
          }
        });
      }

      if (showCoverage && showTransitStops && coverageRadiusM > 0 && transitStops.length > 0) {
        const features = transitStops.map((stop) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [stop.longitude, stop.latitude]
          },
          properties: {
            radius: coverageRadiusM
          }
        }));

        map.addSource(coverageSourceId, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features
          }
        });

        map.addLayer({
          id: coverageLayerId,
          type: "circle",
          source: coverageSourceId,
          paint: {
            "circle-color": "#60a5fa",
            "circle-opacity": 0.11,
            "circle-stroke-color": "#3b82f6",
            "circle-stroke-width": 1,
            "circle-radius": 52
          }
        });
      }
    };

    const onZoom = () => {
      const zoom = map.getZoom();
      applyTransitMarkerVisibility(transitMarkerElementsRef.current, zoom);
      const showLabels = zoom >= TRANSIT_STOP_LABEL_MIN_ZOOM;
      for (const { label, mode } of transitLabelElementsRef.current) {
        const allowMetroLabel = mode !== "metro" || showMetroRoutes;
        label.style.display = showLabels && allowMetroLabel ? "inline" : "none";
      }
    };
    map.on("zoom", onZoom);

    if (map.isStyleLoaded()) {
      renderTransitLayers();
      return () => {
        map.off("zoom", onZoom);
      };
    }

    const onLoad = () => renderTransitLayers();
    map.once("load", onLoad);
    return () => {
      map.off("zoom", onZoom);
      map.off("load", onLoad);
    };
  }, [showTransitStops, showMetroRoutes, showCoverage, transitStops, metroRoutes, coverageRadiusM]);

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

