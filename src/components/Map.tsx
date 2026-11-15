"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type Map as MapInstance,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { geoPaint, type StyleLayer } from "./mapColors";

// Turbopack can't resolve maplibre-gl v6's default worker import; the worker
// bundle is copied to public/ and wired up explicitly.
setWorkerUrl("/maplibre-gl-worker.js");

// Dark basemap without labels (project doc v3) so the TPI reds stand out;
// city labels go in a separate layer on top. CARTO basemaps are free with
// attribution.
const BASEMAP =
  "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json";

function applyGeoColors(map: MapInstance) {
  for (const layer of map.getStyle()?.layers ?? []) {
    const paint = geoPaint(layer as StyleLayer);
    if (!paint) continue;
    try {
      map.setPaintProperty(layer.id, paint[0] as never, paint[1] as never);
    } catch {
      // a layer that refuses the colour keeps the style's own
    }
  }
}

export default function Map({
  bounds,
  center = [-51.5, -30.0] as [number, number],
  zoom = 7,
  minZoom = 5,
  maxZoom = 17,
  onReady,
  children,
}: {
  bounds?: [number, number, number, number]; // [w, s, e, n]
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  onReady?: (map: MapInstance | null) => void;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const ready = useRef(onReady);
  useEffect(() => {
    ready.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (!ref.current) return;
    const map = new MapLibreMap({
      container: ref.current,
      style: BASEMAP,
      center,
      zoom,
      minZoom,
      maxZoom,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl(), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    // Before the first tiles are drawn, so the grey style never flashes.
    map.once("style.load", () => applyGeoColors(map));
    map.on("load", () => {
      mapRef.current = map;
      // Debug/introspection handle — lets headless QA inspect layer state.
      (window as unknown as { __map?: MapInstance }).__map = map;
      if (bounds) fit(map, bounds);
      ready.current?.(map);
    });
    return () => {
      mapRef.current = null;
      ready.current?.(null);
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fit when the AOI changes (event switch) without re-creating the map.
  useEffect(() => {
    if (mapRef.current?.loaded() && bounds) fit(mapRef.current, bounds);
  }, [bounds]);

  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="h-full w-full" />
      {children}
    </div>
  );
}

function fit(map: MapInstance, b: [number, number, number, number]) {
  map.fitBounds(
    [
      [b[0], b[1]],
      [b[2], b[3]],
    ],
    { padding: 60, duration: 500 }
  );
}
