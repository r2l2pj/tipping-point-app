"use client";

import { useEffect, useRef } from "react";
import type {
  ImageSource,
  Map as MapInstance,
  MapMouseEvent,
} from "maplibre-gl";
import { Marker, Popup } from "maplibre-gl";
import type { CaseBundle, DayPoint, PriorityZone } from "@/lib/types";
import {
  bboxPolygon,
  boundsToImageCoordinates,
  fmtDate,
  mockScalarGrid,
  mockTpiGrid,
  nearestPlace,
  resolveDataUrl,
  rstFor,
  tpiClass,
} from "@/lib/tpi";

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
  tpiImg: "tp-tpi-img",
  fcast: "tp-fcast",
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
  tpiRaster: "tp-tpi-raster",
  tpiCritical: "tp-tpi-critical-line",
  tpiHatch: "tp-tpi-hatch",
  fcastHatch: "tp-fcast-hatch",
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
  const fcastMarker = useRef<Marker | null>(null);
  const state = useRef<{ bundle?: CaseBundle; day?: DayPoint }>({});
  const day = bundle?.series?.days[dayIndex];
  const isForecast = day?.kind === "forecast";

  // v4 image-source contract: when the manifest carries a pre-rendered
  // EPSG:3857 PNG for this day, show it as a raster layer; the synthetic
  // mockTpiGrid is only the fallback when no PNG exists.
  const pngLayers = (bundle?.manifest?.layers ?? []).filter((l) => l.png);
  const wanted = layers.tpiSlide ? "slide" : layers.tpiFlood ? "flood" : null;
  const candidates = day ? pngLayers.filter((l) => l.date === day.date) : [];
  const activePng =
    candidates.find((l) => wanted && l.id.includes(wanted)) ?? candidates[0];
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
    map.addSource(SRC.fcast, { type: "geojson", data: EMPTY });
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
      { id: LYR.fcastHatch, type: "fill", source: SRC.fcast,
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
      fcastMarker.current?.remove();
      for (const l of layers) if (map.getLayer(l.id)) map.removeLayer(l.id);
      if (map.getLayer(LYR.tpiRaster)) map.removeLayer(LYR.tpiRaster);
      for (const s of Object.values(SRC)) if (map.getSource(s)) map.removeSource(s);
      if (map.hasImage("tp-hatch")) map.removeImage("tp-hatch");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Mutate data + visibility when state changes.
  useEffect(() => {
    if (!map || !bundle) return;
    state.current = { bundle, day };
    const set = (s: string, d: GeoJSON.FeatureCollection) =>
      (map.getSource(s) as { setData?: (x: GeoJSON.FeatureCollection) => void } | undefined)?.setData?.(d);
    const vis = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };

    const tpiOn = layers.tpiFlood || layers.tpiSlide;
    const usePng = tpiOn && !!activePng;

    // Image source for the day's PNG frame (created lazily — MapLibre image
    // sources need url+coordinates up front; the raster layer sits below
    // permanent water per the v4 layer order).
    const img = map.getSource(SRC.tpiImg) as ImageSource | undefined;
    if (activePng) {
      const b = activePng.bounds ?? bundle.bbox;
      const spec = {
        url: resolveDataUrl(activePng.png!),
        coordinates: boundsToImageCoordinates(b),
      };
      if (img) img.updateImage(spec);
      else {
        map.addSource(SRC.tpiImg, { type: "image", ...spec });
        map.addLayer(
          {
            id: LYR.tpiRaster,
            type: "raster",
            source: SRC.tpiImg,
            paint: { "raster-opacity": 0.9 },
            layout: { visibility: "none" },
          } as never,
          LYR.waterFill
        );
      }
      // v4: forecast frames never look like observed — 50% opacity + hatch +
      // label (observed frames keep full-strength palette).
      map.setPaintProperty(
        LYR.tpiRaster,
        "raster-opacity",
        isForecast ? 0.5 : 0.9
      );
    }

    set(SRC.tpi, usePng ? EMPTY : mockTpiGrid(bundle.bbox, hotspots, scale));
    set(
      SRC.fcast,
      usePng && isForecast
        ? bboxPolygon(activePng!.bounds ?? bundle.bbox)
        : EMPTY
    );
    set(SRC.imerg, mockScalarGrid(bundle.bbox, dayIndex + 1, scale));
    set(SRC.smap, mockScalarGrid(bundle.bbox, dayIndex + 9, scale));
    set(SRC.nisar, mockScalarGrid(bundle.bbox, dayIndex + 17, scale));
    set(SRC.water, bundle.water ?? EMPTY);
    set(SRC.flood, bundle.flood ?? EMPTY);
    set(SRC.scars, bundle.scars ?? EMPTY);
    set(SRC.places, bundle.places ?? EMPTY);

    vis(LYR.tpiRaster, usePng);
    vis(LYR.tpi, tpiOn && !usePng);
    vis(LYR.tpiCritical, tpiOn && !usePng);
    vis(LYR.tpiHatch, tpiOn && isForecast && !usePng);
    vis(LYR.fcastHatch, usePng && isForecast);
    vis(LYR.imerg, layers.imerg);
    vis(LYR.smap, layers.smap);
    vis(LYR.nisar, layers.nisar);
    vis(LYR.floodFill, showFlood);
    vis(LYR.floodLine, showFlood);
    vis(LYR.scarsFill, showFlood || layers.nisar);
    vis(LYR.scarsLine, showFlood || layers.nisar);

    // "Forecast" label — pinned to the top edge of the frame on any
    // forecast day, PNG or mock (v4: previsão sempre rotulada).
    if (!fcastMarker.current) {
      const el = document.createElement("div");
      el.className = "tp-forecast-label";
      el.textContent = "FORECAST";
      fcastMarker.current = new Marker({ element: el, anchor: "top" });
    }
    if (tpiOn && isForecast) {
      const b = activePng?.bounds ?? bundle.bbox;
      fcastMarker.current
        .setLngLat([(b[0] + b[2]) / 2, b[3]])
        .addTo(map);
    } else {
      fcastMarker.current.remove();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, bundle, dayIndex, layers, showFlood, activePng]);

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

  // Click on a TPI frame -> popup with place name, TPI class, R/S/T values
  // and the data date (v4 spec). Works on both the mock grid (per-cell values)
  // and PNG raster frames (day-level values).
  useEffect(() => {
    if (!map) return;
    const popup = new Popup({ closeButton: false, className: "tp-popup" });
    const visible = (id: string) =>
      map.getLayer(id) &&
      map.getLayoutProperty(id, "visibility") === "visible";
    const onClick = (e: MapMouseEvent) => {
      const { bundle: b, day: d } = state.current;
      if (!b) return;
      let cls: string;
      let v: number;
      if (visible(LYR.tpi)) {
        const feats = map.queryRenderedFeatures(e.point, {
          layers: [LYR.tpi],
        });
        const p = feats?.[0]?.properties;
        if (!p) return;
        cls = String(p.class);
        v = Number(p.tpi);
      } else if (visible(LYR.tpiRaster)) {
        if (!d) return;
        v = d.tpi;
        cls = tpiClass(v).label;
      } else {
        return;
      }
      const { r, s, t } = rstFor(d, b.series?.rain_p95_mm, v);
      const place = nearestPlace(b.places, e.lngLat.lng, e.lngLat.lat);
      const dd = b.data_dates ?? {};
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="tp-popup-body">` +
            (place ? `<strong>${place}</strong><br/>` : "") +
            `<strong>${cls} risk</strong> · TPI ${v.toFixed(2)}<br/>` +
            `R ${r.toFixed(2)} · S ${s.toFixed(2)} · T ${t.toFixed(2)}<br/>` +
            `<span>data ${d ? fmtDate(d.date) : "—"} · IMERG ${fmtDate(String(dd.imerg ?? ""))} · SMAP ${fmtDate(String(dd.smap ?? ""))}</span>` +
          `</div>`
        )
        .addTo(map);
    };
    map.on("click", onClick as never);
    return () => {
      map.off("click", onClick as never);
      popup.remove();
    };
  }, [map]);

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
