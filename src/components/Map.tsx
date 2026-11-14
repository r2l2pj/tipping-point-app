"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Dark basemap so the TPI reds and water blues stand out (doc visual guideline).
// CARTO basemaps are free with attribution.
const BASEMAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export default function Map({
  center = [-51.5, -30.0] as [number, number],
  zoom = 7,
}: {
  center?: [number, number];
  zoom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new MapLibreMap({
      container: ref.current,
      style: BASEMAP,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl(), "top-right");
    return () => map.remove();
  }, [center, zoom]);

  return <div ref={ref} className="h-full w-full" />;
}
