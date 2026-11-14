"use client";

import { useEffect, useRef } from "react";
import type {
  ImageSource,
  Map as MapInstance,
  MapMouseEvent,
} from "maplibre-gl";
import { Marker, Popup } from "maplibre-gl";
import type {
  CaseBundle,
  DayPoint,
  ManifestLayer,
  PriorityZone,
} from "@/lib/types";
import type { CogRSTUrls } from "@/lib/cog";
import { canonicalCaseId, forecastSourceLabel } from "@/lib/contract";
import {
  assetUrl,
  dropSource,
  fetchGeo,
  fmtDataDate,
  fmtDate,
  geoUrl,
  isForecastLayer,
  manifestRaster,
  overlayPlan,
  pointInPolygons,
  rankedZonePoints,
  resolvePixelValues,
  safeImageUpdate,
  type PixelValues,
  type TabKey,
  type ToggleLayerKey,
} from "@/lib/layers";
import {
  bboxPolygon,
  boundsToImageCoordinates,
  nearestPlace,
  rstFor,
  tpiClass,
} from "@/lib/tpi";

export interface LayerState {
  tpiFlood: boolean;
  tpiSlide: boolean;
  imerg: boolean;
  smap: boolean;
  nisar: boolean;
}

const SRC = {
  dem: "tp-dem",
  hillImg: "tp-hill-img",
  tpi: "tp-tpi",
  tpiImg: "tp-tpi-img",
  fcast: "tp-fcast",
  imerg: "tp-imerg",
  smap: "tp-smap",
  nisar: "tp-nisar",
  water: "tp-water",
  flood: "tp-flood",
  scars: "tp-scars",
  opera: "tp-opera-img",
  nl: "tp-nl-img",
  tml: "tp-tml-img",
  muni: "tp-muni",
  catalog: "tp-catalog",
  places: "tp-places",
  zones: "tp-zones",
};

// Doc layer order (bottom -> top): basemap > hillshade > TPI/forecast >
// permanent water > confirmed flood > landslide candidates > municipal
// boundaries > catalog points > city labels. Dynamic image overlays
// (opera_validation / night_lights / t_ml) slot in below the muni lines.
const LYR = {
  hillshade: "tp-hillshade",
  hillImg: "tp-hill-img-lyr",
  imerg: "tp-imerg-lyr",
  smap: "tp-smap-lyr",
  nisar: "tp-nisar-lyr",
  tpiRaster: "tp-tpi-raster",
  fcastHatch: "tp-fcast-hatch",
  waterFill: "tp-water-fill",
  river: "tp-river-line",
  floodFill: "tp-flood-fill",
  floodLine: "tp-flood-line",
  scarsFill: "tp-scars-fill",
  scarsLine: "tp-scars-line",
  opera: "tp-opera-lyr",
  nl: "tp-nl-lyr",
  tml: "tp-tml-lyr",
  zonesFill: "tp-zones-fill",
  zonesLine: "tp-zones-line",
  muni: "tp-muni-line",
  catalog: "tp-catalog-circle",
  cityLabel: "tp-city-label",
  riverLabel: "tp-river-label",
};

// Image-source/layer pairs created lazily when the manifest provides the
// PNG — removed again on unmount.
const DYNAMIC_IMG: [string, string][] = [
  [LYR.tpiRaster, SRC.tpiImg],
  [LYR.hillImg, SRC.hillImg],
  [LYR.imerg, SRC.imerg],
  [LYR.smap, SRC.smap],
  [LYR.nisar, SRC.nisar],
  [LYR.opera, SRC.opera],
  [LYR.nl, SRC.nl],
  [LYR.tml, SRC.tml],
];

// Free Mapzen Terrarium elevation tiles — standard source for MapLibre
// hillshade demos (AWS open-data registry).
const TERRAIN = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function useMapLayers(
  map: MapInstance | null,
  bundle: CaseBundle | undefined,
  dayIndex: number,
  layers: LayerState,
  showFlood: boolean,
  tab?: TabKey
) {
  const markers = useRef<Marker[]>([]);
  const fcastMarker = useRef<Marker | null>(null);
  const clickSeq = useRef(0);
  const state = useRef<{
    bundle?: CaseBundle;
    day?: DayPoint;
    activePng?: ManifestLayer;
    caseDir?: string;
    rstUrls?: CogRSTUrls;
    bandOrder?: string[];
  }>({});
  // Lazily fetched geojson — sources start EMPTY; each product's file is
  // pulled by URL the first time its layer is shown (payload ruling: no
  // geojson rides inside the RSC bundle). `fc` is also the popup's lookup
  // data (municipal boundaries, flood polygons).
  const geoData = useRef<
    Record<string, { url: string; fc: GeoJSON.FeatureCollection | null }>
  >({});
  const loading = useRef<Map<string, string>>(new Map());
  const chip = useRef<HTMLDivElement | null>(null);
  // PNG frames that 404'd — skipped on later days and noted via the chip
  // ("frame unavailable") instead of crashing the map.
  const frameFailed = useRef<Set<string>>(new Set());
  const frameNote = useRef<string | null>(null);
  const imgUrls = useRef<Record<string, string>>({});
  const day = bundle?.series?.days[dayIndex];

  // Manifest asset paths resolve under /data/<canonical-case-dir>/ — the v4
  // data folders are the canonical underscore ids (rs_2024, wa_2025, now).
  const caseDir = canonicalCaseId(
    bundle?.manifest?.event ?? bundle?.id ?? ""
  );

  // v4 image-source contract: when the manifest carries a pre-rendered
  // EPSG:3857 PNG for this day, show it as a raster layer — no raster in
  // the manifest means no pixels, never a synthetic grid.
  const pngLayers = (bundle?.manifest?.layers ?? []).filter((l) => l.png);
  const wanted = layers.tpiSlide ? "slide" : layers.tpiFlood ? "flood" : null;
  const candidates = day ? pngLayers.filter((l) => l.date === day.date) : [];
  const activePng =
    candidates.find((l) => wanted && l.id.includes(wanted)) ?? candidates[0];
  // Forecast frames never look observed: the manifest flag or a *_d[1-3] id
  // marks a forecast PNG, or the timeline day itself is a forecast day.
  const isForecast =
    (activePng ? isForecastLayer(activePng) : false) ||
    day?.kind === "forecast";
  const plan = overlayPlan(tab);
  const zones = bundle ? zoneProps(bundle) : [];

  // Create sources/layers once per map instance.
  useEffect(() => {
    if (!map) return;

    map.addSource(SRC.dem, { type: "raster-dem", tiles: [TERRAIN], encoding: "terrarium", tileSize: 256, maxzoom: 12 });
    map.addSource(SRC.fcast, { type: "geojson", data: EMPTY });
    map.addSource(SRC.water, { type: "geojson", data: EMPTY });
    map.addSource(SRC.flood, { type: "geojson", data: EMPTY });
    map.addSource(SRC.scars, { type: "geojson", data: EMPTY });
    map.addSource(SRC.zones, { type: "geojson", data: EMPTY });
    map.addSource(SRC.muni, { type: "geojson", data: EMPTY });
    map.addSource(SRC.catalog, { type: "geojson", data: EMPTY });
    map.addSource(SRC.places, { type: "geojson", data: bundle?.places ?? EMPTY });

    const layers = [
      { id: LYR.hillshade, type: "hillshade", source: SRC.dem,
        paint: { "hillshade-exaggeration": 0.15, "hillshade-shadow-color": "#0b0d12" },
        layout: {} },
      { id: LYR.fcastHatch, type: "fill", source: SRC.fcast,
        paint: { "fill-pattern": "tp-hatch", "fill-opacity": 0.35 },
        layout: { visibility: "none" } },
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
      // Priority zones: the full polygon set paints as a subtle risk-shaded
      // fill (top-10 get HTML label markers — see rankedZonePoints).
      { id: LYR.zonesFill, type: "fill", source: SRC.zones,
        paint: {
          "fill-color": ["match", ["get", "class"],
            "Critical", "#B2182B", "High", "#EF8A62", "#999999"],
          "fill-opacity": 0.18,
        },
        layout: {} },
      { id: LYR.zonesLine, type: "line", source: SRC.zones,
        paint: { "line-color": "#B2182B", "line-width": 0.7, "line-opacity": 0.6 },
        layout: {} },
      // Municipal boundaries: thin white reference lines (0.5 px, 40%).
      { id: LYR.muni, type: "line", source: SRC.muni,
        paint: { "line-color": "#FFFFFF", "line-width": 0.5, "line-opacity": 0.4 },
        layout: {} },
      // Landslide catalog: 6 px white dots with a black edge (validation tab).
      { id: LYR.catalog, type: "circle", source: SRC.catalog,
        paint: {
          "circle-radius": 3,
          "circle-color": "#FFFFFF",
          "circle-stroke-color": "#000000",
          "circle-stroke-width": 1,
        },
        layout: { visibility: "none" } },
      { id: LYR.cityLabel, type: "symbol", source: SRC.places,
        paint: { "text-color": "#E8EAED", "text-halo-color": "#000000", "text-halo-width": 1.2 },
        layout: {
          "text-field": ["get", "name"],
          "text-size": ["match", ["get", "kind"], "city", 13, 12],
          "text-font": ["Open Sans Bold"],
          "text-offset": [0, 0.6],
        },
        filter: ["!=", ["get", "kind"], "river"] },
      { id: LYR.riverLabel, type: "symbol", source: SRC.places,
        paint: { "text-color": "#7EB6E8", "text-halo-color": "#000000", "text-halo-width": 1 },
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-font": ["Open Sans Italic"],
        },
        filter: ["==", ["get", "kind"], "river"] },
    ] as const;

    addHatch(map);

    // A dynamic image source whose PNG 404s fires 'error' asynchronously —
    // drop it so it never paints a broken frame or crashes a later update.
    const onMapError = (e: { sourceId?: string }) => {
      const sid = e?.sourceId;
      if (!sid) return;
      const pair = DYNAMIC_IMG.find(([, s]) => s === sid);
      if (!pair) return;
      const [lyr] = pair;
      const u = imgUrls.current[sid];
      if (u) frameFailed.current.add(u);
      dropSource(map, sid, lyr);
      if (sid === SRC.tpiImg) {
        const d = state.current.day;
        frameNote.current = `TPI frame unavailable — ${d ? fmtDate(d.date) : "this day"}`;
      }
      refreshChip(map, loading.current, chip, frameNote.current);
    };
    map.on("error", onMapError as never);

    for (const l of layers) {
      const { id, type, source, paint, layout } = l;
      const spec = { id, type, source, paint, layout } as Record<string, unknown>;
      if ("filter" in l && l.filter) spec.filter = l.filter;
      map.addLayer(spec as never);
    }

    return () => {
      map.off("error", onMapError as never);
      fcastMarker.current?.remove();
      chip.current?.remove();
      chip.current = null;
      loading.current.clear();
      for (const l of layers) if (map.getLayer(l.id)) map.removeLayer(l.id);
      for (const [lyr, src] of DYNAMIC_IMG) {
        if (map.getLayer(lyr)) map.removeLayer(lyr);
        if (map.getSource(src)) map.removeSource(src);
      }
      for (const s of Object.values(SRC)) if (map.getSource(s)) map.removeSource(s);
      if (map.hasImage("tp-hatch")) map.removeImage("tp-hatch");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Mutate data + visibility when state changes. The whole effect is guarded
  // — a missing/failed layer must never throw through React into the error
  // boundary ("Dashboard data failed to load").
  useEffect(() => {
    if (!map || !bundle) return;
    try {
    // COG score layers the case publishes (contract: r_series / s_series
    // daily multiband, t_slide / t_flood static terrain) — resolved to URLs
    // for the popup pixel read. Band order for series COGs falls back to the
    // timeline day dates when GDAL descriptions are absent.
    const cogById = (id: string) =>
      assetUrl(
        caseDir,
        bundle.manifest?.layers?.find((l) => l.id === id)?.cog
      );
    const rstUrls: CogRSTUrls = {
      r: cogById("r_series"),
      s: cogById("s_series"),
      t: cogById(activePng?.id.includes("flood") ? "t_flood" : "t_slide"),
    };
    const bandOrder =
      bundle.series?.days?.map((d) => d.date) ??
      bundle.manifest?.layers
        ?.filter((l) => l.id === activePng?.id && l.date)
        .map((l) => l.date as string);
    state.current = { bundle, day, activePng, caseDir, rstUrls, bandOrder };
    const set = (s: string, d: GeoJSON.FeatureCollection) =>
      (map.getSource(s) as { setData?: (x: GeoJSON.FeatureCollection) => void } | undefined)?.setData?.(d);
    const vis = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };

    const tpiOn = (layers.tpiFlood || layers.tpiSlide) && plan.tpi;
    const usePng = tpiOn && !!activePng;

    // NASA toggle rasters (IMERG / SMAP / NISAR): pixels only when the
    // manifest ships a real raster for the layer — never synthetic data.
    const rasterToggle = (key: ToggleLayerKey, src: string, lyr: string) => {
      const l = manifestRaster(bundle.manifest?.layers, key, day?.date);
      const url = assetUrl(caseDir, l?.png);
      if (l && url) {
        ensureImageLayer(
          map,
          src,
          lyr,
          url,
          boundsToImageCoordinates(l.bounds ?? bundle.bbox),
          0.7,
          LYR.muni
        );
        vis(lyr, layers[key]);
      } else {
        vis(lyr, false);
      }
    };
    rasterToggle("imerg", SRC.imerg, LYR.imerg);
    rasterToggle("smap", SRC.smap, LYR.smap);
    rasterToggle("nisar", SRC.nisar, LYR.nisar);

    // Pre-rendered EPSG:3857 PNGs become image sources on demand; the raster
    // layer goes in at `before` so the doc order holds. `on` is applied after
    // creation (layers start hidden).
    const imgOverlay = (
      manifestId: string,
      src: string,
      lyr: string,
      opacity: number,
      before: string,
      on: boolean
    ) => {
      const l = bundle.manifest?.layers?.find(
        (x) => x.id === manifestId && x.png
      );
      const url = assetUrl(caseDir, l?.png);
      if (l && url) {
        ensureImageLayer(
          map,
          src,
          lyr,
          url,
          boundsToImageCoordinates(l.bounds ?? bundle.bbox),
          opacity,
          before
        );
        vis(lyr, on);
      } else {
        vis(lyr, false);
      }
    };

    // Hillshade: manifest PNG at 15% when published, else the Terrarium
    // raster-dem fallback (kept subtle per doc).
    imgOverlay("hillshade", SRC.hillImg, LYR.hillImg, 0.15, LYR.hillshade, true);
    vis(LYR.hillshade, !map.getLayer(LYR.hillImg) ||
      map.getLayoutProperty(LYR.hillImg, "visibility") === "none");

    // Tab overlays (doc order): pre-painted rasters below the muni lines.
    imgOverlay("opera_validation", SRC.opera, LYR.opera, 0.85, LYR.muni,
      tab === undefined ? false : plan.operaValidation);
    imgOverlay("night_lights", SRC.nl, LYR.nl, 0.85, LYR.muni,
      tab === undefined ? false : plan.nightLights);
    imgOverlay("t_ml", SRC.tml, LYR.tml, 0.7, LYR.muni, true);

    // Image source for the day's PNG frame (created lazily — MapLibre image
    // sources need url+coordinates up front; the raster layer sits below
    // permanent water per the v4 layer order). A frame that 404'd before is
    // skipped outright; a fresh failure drops the source/layer and leaves a
    // "frame unavailable" note — never a throw.
    const img = map.getSource(SRC.tpiImg) as ImageSource | undefined;
    const tpiUrl = assetUrl(caseDir, activePng?.png);
    frameNote.current = null;
    let frameOk = false;
    if (activePng && tpiUrl && !frameFailed.current.has(tpiUrl)) {
      const b = activePng.bounds ?? bundle.bbox;
      const spec = {
        url: tpiUrl,
        coordinates: boundsToImageCoordinates(b),
      };
      try {
        imgUrls.current[SRC.tpiImg] = tpiUrl;
        if (img) {
          if (!safeImageUpdate(img, spec)) throw new Error("updateImage");
        } else {
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
        frameOk = true;
        // v4: forecast frames never look like observed — 50% opacity +
        // hatch + label (observed frames keep full-strength palette).
        map.setPaintProperty(
          LYR.tpiRaster,
          "raster-opacity",
          isForecast ? 0.5 : 0.9
        );
      } catch {
        frameFailed.current.add(tpiUrl);
        dropSource(map, SRC.tpiImg, LYR.tpiRaster);
      }
    }
    if (activePng && tpiUrl && !frameOk) {
      frameNote.current = `TPI frame unavailable — ${day ? fmtDate(day.date) : "this day"}`;
    } else if (tpiOn && !activePng) {
      // The manifest published no PNG for this day — say so instead of
      // leaving a bare basemap that reads as broken.
      frameNote.current = day
        ? `No TPI frame published for ${fmtDate(day.date)}`
        : "No TPI frames published for this case";
    }
    refreshChip(map, loading.current, chip, frameNote.current);

    set(
      SRC.fcast,
      usePng && isForecast
        ? bboxPolygon(activePng!.bounds ?? bundle.bbox)
        : EMPTY
    );

    // Lazy geojson loads — a source fetches its product file by URL the
    // first time it is wanted, then caches it (per-URL cache shared with
    // any panel reader). Loading a URL the source already holds is a no-op.
    const markLoading = (src: string, label: string, on: boolean) => {
      if (on) loading.current.set(src, label);
      else loading.current.delete(src);
      refreshChip(map, loading.current, chip, frameNote.current);
    };
    const loadGeo = (src: string, label: string, url: string | undefined) => {
      const srcObj = map.getSource(src) as
        | { setData?: (d: GeoJSON.FeatureCollection) => void }
        | undefined;
      if (!srcObj) return;
      if (!url) {
        geoData.current[src] = { url: "", fc: null };
        srcObj.setData?.(EMPTY);
        return;
      }
      const hit = geoData.current[src];
      if (hit?.url === url) {
        if (hit.fc) srcObj.setData?.(hit.fc);
        return; // already loaded (or fetch in flight — it will setData)
      }
      geoData.current[src] = { url, fc: null };
      markLoading(src, label, true);
      fetchGeo(url).then((fc) => {
        geoData.current[src] = { url, fc };
        (
          map.getSource(src) as
            | { setData?: (d: GeoJSON.FeatureCollection) => void }
            | undefined
        )?.setData?.(fc ?? EMPTY);
        markLoading(src, label, false);
      });
    };
    const url = (key: string, fixed: string) =>
      geoUrl(bundle, caseDir, key, fixed);
    // Map chrome loads eagerly; overlays only when their tab/toggle asks.
    loadGeo(SRC.water, "permanent water", url("permanent_water", "geojson/permanent_water.geojson"));
    loadGeo(SRC.zones, "priority zones", url("priority_zones", "geojson/priority_zones.geojson"));
    loadGeo(SRC.muni, "boundaries", url("municipal_boundaries", "geojson/municipal_boundaries.geojson"));
    const wantFlood = tab === undefined ? showFlood : plan.floodPolygons;
    const wantScars = tab === undefined ? showFlood || layers.nisar : plan.landslideCandidates;
    const wantCatalog = tab !== undefined && plan.catalogPoints;
    if (wantFlood) loadGeo(SRC.flood, "flood extent", url("flood_confirmed", "geojson/flood_confirmed.geojson"));
    if (wantScars) loadGeo(SRC.scars, "landslide candidates", url("landslide_candidates", "geojson/landslide_candidates.geojson"));
    if (wantCatalog) loadGeo(SRC.catalog, "landslide catalog", url("landslide_catalog", "geojson/landslide_catalog.geojson"));
    set(SRC.places, bundle.places ?? EMPTY);

    vis(LYR.tpiRaster, usePng && frameOk);
    vis(LYR.fcastHatch, usePng && isForecast && frameOk);
    // With no tab context the caller drives flood/scars via showFlood (and
    // the nisar toggle); with a tab the overlayPlan decides.
    vis(LYR.floodFill, wantFlood);
    vis(LYR.floodLine, wantFlood);
    vis(LYR.scarsFill, wantScars);
    vis(LYR.scarsLine, wantScars);
    vis(LYR.catalog, wantCatalog);

    // Forecast label — pinned to the top edge of the frame on any forecast
    // day (v4: previsão sempre rotulada). The text names the
    // forecast source: "previsão perfeita" on replay, "GEOS-FP" live.
    if (!fcastMarker.current) {
      const el = document.createElement("div");
      el.className = "tp-forecast-label";
      fcastMarker.current = new Marker({ element: el, anchor: "top" });
    }
    fcastMarker.current.getElement().textContent =
      forecastSourceLabel(bundle.manifest?.forecast_source) ?? "forecast";
    if (tpiOn && isForecast) {
      const b = activePng?.bounds ?? bundle.bbox;
      fcastMarker.current
        .setLngLat([(b[0] + b[2]) / 2, b[3]])
        .addTo(map);
    } else {
      fcastMarker.current.remove();
    }
    } catch (err) {
      console.warn("MapLayers update failed (map kept alive)", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, bundle, dayIndex, layers, showFlood, tab, activePng]);

  // Priority-zone HTML markers — top 10 by rank, anchored at the polygon
  // label point (real files are Polygons, not Points). The full set paints
  // via the tp-zones fill/line layers above.
  useEffect(() => {
    if (!map) return;
    markers.current = rankedZonePoints(bundle?.zones?.features).map(
      ({ zone: p, at }) => {
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
          .setLngLat(at)
          .addTo(map);
      }
    );
    return () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];
    };
  }, [map, bundle]);

  // Click on a TPI frame -> popup with place name, TPI class, R/S/T values
  // and the data date (v4 spec). Reads day-level values off the PNG raster
  // frame — there is no synthetic grid to query.
  useEffect(() => {
    if (!map) return;
    const popup = new Popup({ closeButton: false, className: "tp-popup" });
    const visible = (id: string) =>
      map.getLayer(id) &&
      map.getLayoutProperty(id, "visibility") === "visible";
    const onClick = (e: MapMouseEvent) => {
      const {
        bundle: b,
        day: d,
        activePng: ap,
        caseDir: cd,
        rstUrls,
        bandOrder,
      } = state.current;
      if (!b) return;
      if (!visible(LYR.tpiRaster) || !d) return;
      const v = d.tpi;
      // Município from the lazily loaded boundaries polygons (bundle copy
      // only as a pre-L14-path fallback); nearest named place otherwise.
      const place =
        pointInPolygons(
          geoData.current[SRC.muni]?.fc ?? b.municipalities,
          e.lngLat.lng,
          e.lngLat.lat
        ) ?? nearestPlace(b.places, e.lngLat.lng, e.lngLat.lat);
      const dd = b.data_dates ?? {};
      const cogUrl = assetUrl(cd ?? "", ap?.cog);
      const seq = ++clickSeq.current;

      const html = (
        pv: PixelValues,
        provenance: string
      ) => {
        const fmt = (value: number | null) =>
          value === null || !Number.isFinite(value) ? "no data" : value.toFixed(2);
        return `<div class="tp-popup-body">` +
          (place ? `<strong>${place}</strong><br/>` : "") +
          `<strong>${pv.tpi === null ? "no data" : `${tpiClass(pv.tpi, b).label} risk`}</strong> · TPI ${fmt(pv.tpi)}<br/>` +
          `R ${fmt(pv.r)} · S ${fmt(pv.s)} · T ${fmt(pv.t)}<br/>` +
          `<span>data ${d ? fmtDataDate(d.date) : "—"} · IMERG ${fmtDataDate(String(dd.imerg ?? ""))} · SMAP ${fmtDataDate(String(dd.smap ?? ""))} · ${provenance}</span>` +
          (cogUrl
            ? `<br/><a href="${cogUrl}" target="_blank" rel="noreferrer">Download COG</a>`
            : "") +
        `</div>`;
      };

      // Render the day-level estimate immediately, then swap in the COG
      // pixel read when it resolves (async-safe: stale clicks are dropped).
      const est = rstFor(d, b.series?.rain_p95_mm, v);
      popup
        .setLngLat(e.lngLat)
        .setHTML(html({ tpi: v, ...est }, "day estimate"))
        .addTo(map);
      void resolvePixelValues(cogUrl, e.lngLat.lng, e.lngLat.lat, {
        day: d,
        rainP95Mm: b.series?.rain_p95_mm,
        tpi: v,
        bandOrder,
        rstUrls,
        caseId: cd,
        kind: ap?.id.includes("flood") ? "flood" : "slide",
      }).then((px) => {
        if (px && seq === clickSeq.current && popup.isOpen()) {
          popup.setHTML(html(px, px.provenance === "gee" ? "GEE point read"
            : px.provenance === "cog" ? "COG pixel read" : "day estimate"));
        }
      });
    };
    map.on("click", onClick as never);
    return () => {
      // Invalidate pending pixel reads — a promise that resolves after
      // unmount must never write into a dead popup.
      clickSeq.current += 1;
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

// Bottom-left chip: currently-loading layers plus a persistent note when the
// day's frame is unavailable. Never throws — the chip is cosmetic.
function refreshChip(
  map: MapInstance,
  loadingMap: Map<string, string>,
  chip: { current: HTMLDivElement | null },
  note: string | null
) {
  try {
    const parts = [...loadingMap.values()].map((l) => `loading ${l}…`);
    if (note) parts.push(note);
    if (parts.length === 0) {
      chip.current?.remove();
      chip.current = null;
      return;
    }
    if (!chip.current) {
      const el = document.createElement("div");
      el.className = "tp-loading-chip";
      map.getContainer().appendChild(el);
      chip.current = el;
    }
    chip.current.textContent = parts.join(" · ");
  } catch {
    // chip write must never take the map down
  }
}

// Lazily add (or update) an image source + raster layer at a fixed stack
// position (`before`). Used for manifest PNGs: the day's TPI frame,
// hillshade, and the tab overlays (opera_validation / night_lights / t_ml).
// A failing PNG drops its source/layer instead of throwing out of the map.
function ensureImageLayer(
  map: MapInstance,
  srcId: string,
  lyrId: string,
  url: string,
  coordinates: ReturnType<typeof boundsToImageCoordinates>,
  opacity: number,
  before?: string
) {
  const src = map.getSource(srcId) as ImageSource | undefined;
  try {
    if (src) {
      if (!safeImageUpdate(src, { url, coordinates })) {
        throw new Error("updateImage failed");
      }
    } else {
      map.addSource(srcId, { type: "image", url, coordinates });
      map.addLayer(
        {
          id: lyrId,
          type: "raster",
          source: srcId,
          paint: { "raster-opacity": opacity },
          layout: { visibility: "none" },
        } as never,
        before
      );
    }
  } catch {
    dropSource(map, srcId, lyrId);
  }
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
