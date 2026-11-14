"use client";

import { useEffect, useRef } from "react";
import type { Map as MapInstance } from "maplibre-gl";
import { Marker, Popup } from "maplibre-gl";
import type { CaseBundle, PriorityZone } from "@/lib/types";
import { mockScalarGrid, mockTpiGrid, fmtDate } from "@/lib/tpi";

// Layer order per project doc v3 (bottom -> top):
// basemap > hillshade > TPI/forecast > permanent water > confirmed flood >
// landslide scars > zone markers > city labels.
export interface LayerState {
  tpiFlood: boolean;
  tpiSlide: boolean;
  imerg: boolean;
  smap: boolean;
  nisar: boolean;
}

const SRC = {
  dem: "tp-dem",
  tpi: "tp-tpi",
  imerg: "tp-imerg",
  smap: "tp-smap",
  nisar: "tp-nisar",
  water: "tp-water",
  flood: "tp-flood",
  scars: "tp-scars",
  places: "tp-places",
};

const LYR = {
  hillshade: "tp-hillshade",
  imerg: "tp-imerg-fill",
  smap: "tp-smap-fill",
  nisar: "tp-nisar-fill",
  tpi: "tp-tpi-fill",
  tpiCritical: "tp-tpi-critical-line",
  tpiHatch: "tp-tpi-hatch",
  waterFill: "tp-water-fill",
  river: "tp-river-line",
  floodFill: "tp-flood-fill",
  floodLine: "tp-flood-line",
  scarsFill: "tp-scars-fill",
  scarsLine: "tp-scars-line",
  cityLabel: "tp-city-label",
  riverLabel: "tp-river-label",
};

// Free Mapzen Terrarium elevation tiles — standard source for MapLibre
// hillshade demos (AWS open-data registry).
const TERRAIN = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function useMapLayers(
  map: MapInstance | null,
  bundle: CaseBundle | undefined,
  dayIndex: number,
  layers: LayerState,
  showFlood: boolean
) {
  const markers = useRef<Marker[]>([]);
  const day = bundle?.series?.days[dayIndex];
  const isForecast = day?.kind === "forecast";
  const scale = day
    ? Math.max(0.15, day.tpi / (bundle?.series?.tpi_threshold ?? 0.6) / 1.3)
    : 1;
  const zones = bundle ? zoneProps(bundle) : [];
  const hotspots = (bundle?.zones?.features ?? [])
    .filter((f) => f.geometry.type === "Point")
    .map((f) => ({
      lon: (f.geometry as GeoJSON.Point).coordinates[0],
      lat: (f.geometry as GeoJSON.Point).coordinates[1],
      tpi: (f.properties?.tpi as number) ?? 0.6,
    }));

  // Create sources/layers once per map instance.
  useEffect(() => {
    if (!map) return;

    map.addSource(SRC.dem, { type: "raster-dem", tiles: [TERRAIN], encoding: "terrarium", tileSize: 256, maxzoom: 12 });
    map.addSource(SRC.tpi, { type: "geojson", data: EMPTY });
    map.addSource(SRC.imerg, { type: "geojson", data: EMPTY });
    map.addSource(SRC.smap, { type: "geojson", data: EMPTY });
    map.addSource(SRC.nisar, { type: "geojson", data: EMPTY });
    map.addSource(SRC.water, { type: "geojson", data: bundle?.water ?? EMPTY });
    map.addSource(SRC.flood, { type: "geojson", data: bundle?.flood ?? EMPTY });
    map.addSource(SRC.scars, { type: "geojson", data: bundle?.scars ?? EMPTY });
    map.addSource(SRC.places, { type: "geojson", data: bundle?.places ?? EMPTY });

    const layers = [
      { id: LYR.hillshade, type: "hillshade", source: SRC.dem,
        paint: { "hillshade-exaggeration": 0.4, "hillshade-shadow-color": "#0b0d12" },
        layout: {} },
      { id: LYR.imerg, type: "fill", source: SRC.imerg,
        paint: { "fill-color": ["interpolate", ["linear"], ["get", "v"], 0.3, "rgba(33,102,172,0)", 1, "rgba(33,102,172,0.75)"] },
        layout: { visibility: "none" } },
      { id: LYR.smap, type: "fill", source: SRC.smap,
        paint: { "fill-color": ["interpolate", ["linear"], ["get", "v"], 0.3, "rgba(140,81,10,0)", 1, "rgba(140,81,10,0.7)"] },
        layout: { visibility: "none" } },
      { id: LYR.nisar, type: "fill", source: SRC.nisar,
        paint: { "fill-color": ["interpolate", ["linear"], ["get", "v"], 0.3, "rgba(84,39,143,0)", 1, "rgba(84,39,143,0.8)"] },
        layout: { visibility: "none" } },
      { id: LYR.tpi, type: "fill", source: SRC.tpi,
        paint: {
          "fill-color": ["match", ["get", "class"], "Moderate", "#FECC5C", "High", "#FD8D3C", "Critical", "#BD0026", "#FFFFB2"],
          "fill-opacity": ["match", ["get", "class"], "Critical", 0.75, "Low", 0.4, 0.65],
        },
        layout: {} },
      { id: LYR.tpiHatch, type: "fill", source: SRC.tpi,
        paint: { "fill-pattern": "tp-hatch", "fill-opacity": 0.35 },
        layout: { visibility: "none" } },
      { id: LYR.tpiCritical, type: "line", source: SRC.tpi,
        paint: { "line-color": "#BD0026", "line-width": 1 },
        layout: {},
        filter: ["==", ["get", "class"], "Critical"] },
      { id: LYR.waterFill, type: "fill", source: SRC.water,
        paint: { "fill-color": "#9ECAE1", "fill-opacity": 0.6 },
        layout: {},
        filter: ["==", ["geometry-type"], "Polygon"] },
      { id: LYR.river, type: "line", source: SRC.water,
        paint: { "line-color": "#4B93C5", "line-width": 1.6 },
        layout: {},
        filter: ["==", ["geometry-type"], "LineString"] },
      { id: LYR.floodFill, type: "fill", source: SRC.flood,
        paint: { "fill-color": "#2166AC", "fill-opacity": 0.75 },
        layout: { visibility: "none" } },
      { id: LYR.floodLine, type: "line", source: SRC.flood,
        paint: { "line-color": "#08306B", "line-width": 1 },
        layout: { visibility: "none" } },
      { id: LYR.scarsFill, type: "fill", source: SRC.scars,
        paint: { "fill-color": "#7B3294", "fill-opacity": 0.8 },
        layout: { visibility: "none" } },
      { id: LYR.scarsLine, type: "line", source: SRC.scars,
        paint: { "line-color": "#ffffff", "line-width": 1 },
        layout: { visibility: "none" } },
      { id: LYR.cityLabel, type: "symbol", source: SRC.places,
        paint: { "text-color": "#E8EAED", "text-halo-color": "#000000", "text-halo-width": 1.2 },
        layout: {
          "text-field": ["get", "name"],
          "text-size": ["match", ["get", "kind"], "city", 13, 11],
          "text-font": ["Open Sans Bold"],
          "text-offset": [0, 0.6],
        },
        filter: ["!=", ["get", "kind"], "river"] },
      { id: LYR.riverLabel, type: "symbol", source: SRC.places,
        paint: { "text-color": "#7EB6E8", "text-halo-color": "#000000", "text-halo-width": 1 },
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-font": ["Open Sans Italic"],
        },
        filter: ["==", ["get", "kind"], "river"] },
    ] as const;

    addHatch(map);
    for (const l of layers) {
      const { id, type, source, paint, layout } = l;
      const spec = { id, type, source, paint, layout } as Record<string, unknown>;
      if ("filter" in l && l.filter) spec.filter = l.filter;
      map.addLayer(spec as never);
    }

    return () => {
      for (const l of layers) if (map.getLayer(l.id)) map.removeLayer(l.id);
      for (const s of Object.values(SRC)) if (map.getSource(s)) map.removeSource(s);
      if (map.hasImage("tp-hatch")) map.removeImage("tp-hatch");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Mutate data + visibility when state changes.
  useEffect(() => {
    if (!map || !bundle) return;
    const set = (s: string, d: GeoJSON.FeatureCollection) =>
      (map.getSource(s) as { setData?: (x: GeoJSON.FeatureCollection) => void } | undefined)?.setData?.(d);
    const vis = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };

    set(SRC.tpi, mockTpiGrid(bundle.bbox, hotspots, scale));
    set(SRC.imerg, mockScalarGrid(bundle.bbox, dayIndex + 1, scale));
    set(SRC.smap, mockScalarGrid(bundle.bbox, dayIndex + 9, scale));
    set(SRC.nisar, mockScalarGrid(bundle.bbox, dayIndex + 17, scale));
    set(SRC.water, bundle.water ?? EMPTY);
    set(SRC.flood, bundle.flood ?? EMPTY);
    set(SRC.scars, bundle.scars ?? EMPTY);
    set(SRC.places, bundle.places ?? EMPTY);

    const tpiOn = layers.tpiFlood || layers.tpiSlide;
    vis(LYR.tpi, tpiOn);
    vis(LYR.tpiCritical, tpiOn);
    vis(LYR.tpiHatch, tpiOn && isForecast);
    vis(LYR.imerg, layers.imerg);
    vis(LYR.smap, layers.smap);
    vis(LYR.nisar, layers.nisar);
    vis(LYR.floodFill, showFlood);
    vis(LYR.floodLine, showFlood);
    vis(LYR.scarsFill, showFlood || layers.nisar);
    vis(LYR.scarsLine, showFlood || layers.nisar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, bundle, dayIndex, layers, showFlood]);

  // Priority-zone HTML markers.
  useEffect(() => {
    if (!map) return;
    markers.current = (bundle?.zones?.features ?? []).map((f) => {
      const p = f.properties as PriorityZone;
      const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
      const el = document.createElement("div");
      el.className = "tp-zone-marker";
      el.innerHTML = `
        <div class="tp-zone-card">
          <div class="tp-zone-head">
            <span class="tp-zone-name">${p.name}</span>
            <span class="tp-zone-badge">${p.class.toUpperCase()}</span>
          </div>
          <div class="tp-zone-sub">${p.hazard}</div>
          <div class="tp-zone-sub">TPI ${p.tpi.toFixed(2)}</div>
        </div>`;
      return new Marker({ element: el, anchor: "bottom" })
        .setLngLat([lon, lat])
        .addTo(map);
    });
    return () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];
    };
  }, [map, bundle]);

  // Click on a TPI cell -> popup with class, TPI and data dates (v3 spec).
  useEffect(() => {
    if (!map || !bundle) return;
    const popup = new Popup({ closeButton: false, className: "tp-popup" });
    const onClick = (e: { features?: { properties?: Record<string, unknown> }[]; lngLat: { lng: number; lat: number } }) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const dd = bundle?.data_dates ?? {};
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="tp-popup-body">
            <strong>${p.class} risk</strong> · TPI ${Number(p.tpi).toFixed(2)}<br/>
            <span>IMERG through ${fmtDate(String(dd.imerg ?? ""))} · SMAP ${fmtDate(String(dd.smap ?? ""))}</span>
          </div>`
        )
        .addTo(map);
    };
    map.on("click", LYR.tpi, onClick as never);
    return () => {
      map.off("click", LYR.tpi, onClick as never);
      popup.remove();
    };
  }, [map, bundle]);

  return zones;
}

function zoneProps(bundle: CaseBundle): PriorityZone[] {
  return (bundle?.zones?.features ?? [])
    .map((f) => f.properties as PriorityZone)
    .sort((a, b) => a.rank - b.rank);
}

// Diagonal-stripe pattern used to mark forecast frames (v3: forecast is always
// hatched and labelled, never confused with observed data).
function addHatch(map: MapInstance) {
  if (map.hasImage("tp-hatch")) return;
  const c = document.createElement("canvas");
  c.width = c.height = 8;
  const ctx = c.getContext("2d")!;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, 10);
  ctx.lineTo(10, -2);
  ctx.stroke();
  map.addImage("tp-hatch", ctx.getImageData(0, 0, 8, 8));
}
