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
import { isPermanentFrameFailure } from "./mapFrameErrors";
import {
  assetUrl,
  dropSource,
  fetchGeo,
  fmtDataDate,
  fmtDate,
  geoUrl,
  forecastChip,
  isForecastLayer,
  isGfsFrame,
  manifestRaster,
  pickTpiFrame,
  probFrame,
  type ProbHorizon,
  overlayPlan,
  pointInPolygons,
  rankedZonePoints,
  zoneLabelPoint,
  resolvePixelValues,
  safeImageUpdate,
  type PixelValues,
  type TabKey,
  type ToggleLayerKey,
  featureCenters,
  standardFlood,
} from "@/lib/layers";
import {
  resolveFrameDate,
  resolveOverlays,
  zoneMarkersOn,
  type MapLayerOptions,
} from "./command/model/overlays";
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
  pTrigger: boolean;
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
  floodPts: "tp-flood-pts",
  scars: "tp-scars",
  opera: "tp-opera-img",
  nl: "tp-nl-img",
  tml: "tp-tml-img",
  prob: "tp-prob-img",
  muni: "tp-muni",
  catalog: "tp-catalog",
  places: "tp-places",
  zones: "tp-zones",
  zonePins: "tp-zone-pins",
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
  floodDot: "tp-flood-dot",
  scarsFill: "tp-scars-fill",
  scarsLine: "tp-scars-line",
  opera: "tp-opera-lyr",
  nl: "tp-nl-lyr",
  tml: "tp-tml-lyr",
  prob: "tp-prob-lyr",
  zonesFill: "tp-zones-fill",
  zonesLine: "tp-zones-line",
  muni: "tp-muni-line",
  catalog: "tp-catalog-circle",
  zoneDot: "tp-zone-dot",
  zoneNum: "tp-zone-num",
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
  tab?: TabKey,
  // Additive (Command Center): without it the hook behaves as before.
  options?: MapLayerOptions
) {
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
  // ("frame unavailable") instead of crashing the map. A network or CORS
  // failure is not kept here (see isPermanentFrameFailure).
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
  const wanted = layers.tpiSlide ? "slide" : layers.tpiFlood ? "flood" : null;
  const frameDate = resolveFrameDate(day?.date, options);
  // L22: on forecast days the real issued GFS frame wins over the
  // perfect-forecast upper bound (see pickTpiFrame).
  const activePng = options?.frameLayer ?? pickTpiFrame(
    bundle?.manifest?.layers,
    frameDate
      ? { date: frameDate, kind: day?.date === frameDate ? day?.kind : undefined }
      : undefined,
    wanted,
    bundle?.series?.reference_date ?? bundle?.reference_date
  );
  // Forecast frames never look observed: the manifest flag or a *_d[1-3] id
  // marks a forecast PNG, or the timeline day itself is a forecast day.
  const isForecast =
    (activePng ? isForecastLayer(activePng) : false) ||
    day?.kind === "forecast" ||
    // With options a hindcast day is drawn as forecast: not an observation.
    (options !== undefined && day?.kind === "hindcast");
  const plan = overlayPlan(tab);
  const overlay = resolveOverlays(tab, showFlood, layers.nisar, options?.overlays);
  const overlayKey = Object.values(overlay).join();
  const zoneMarkers = zoneMarkersOn(options);
  const zones = bundle ? zoneProps(bundle) : [];

  // Create sources/layers once per map instance.
  useEffect(() => {
    if (!map) return;

    map.addSource(SRC.dem, { type: "raster-dem", tiles: [TERRAIN], encoding: "terrarium", tileSize: 256, maxzoom: 12 });
    map.addSource(SRC.fcast, { type: "geojson", data: EMPTY });
    map.addSource(SRC.water, { type: "geojson", data: EMPTY });
    map.addSource(SRC.flood, { type: "geojson", data: EMPTY });
    map.addSource(SRC.floodPts, { type: "geojson", data: EMPTY });
    map.addSource(SRC.scars, { type: "geojson", data: EMPTY });
    map.addSource(SRC.zones, { type: "geojson", data: EMPTY });
    map.addSource(SRC.muni, { type: "geojson", data: EMPTY });
    map.addSource(SRC.catalog, { type: "geojson", data: EMPTY });
    map.addSource(SRC.places, { type: "geojson", data: bundle?.places ?? EMPTY });
    map.addSource(SRC.zonePins, { type: "geojson", data: EMPTY });

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
        // The live permanent_water layer (MCD12Q1 water class) carries the
        // open Atlantic as one ~212,000 km2 polygon; a reference layer
        // should not paint the ocean. Inland water (Lagoa dos Patos
        // ~10,000 km2) stays.
        filter: ["all", ["==", ["geometry-type"], "Polygon"],
          ["<", ["to-number", ["coalesce", ["get", "area_km2"], 0]], 50000]] },
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
      // Flood polygons of ~1 km² are sub-pixel at the regional zoom: a dot
      // per polygon keeps them findable until the shapes themselves show.
      { id: LYR.floodDot, type: "circle", source: SRC.floodPts, maxzoom: 10,
        paint: { "circle-radius": 5, "circle-color": "#2166AC",
          "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 },
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
          // R3 Now zones seen only by satellite (sources without
          // "tpi-critical") are observations: neutral blue, never a class
          // color. Replay zones have no `sources`.
          "fill-color": ["case",
            ["all", ["has", "sources"],
              ["!", ["in", "tpi", ["to-string", ["get", "sources"]]]]], "#4B93C5",
            ["match", ["get", "class"],
              "Critical", "#B2182B", "High", "#EF8A62", "#999999"]],
          "fill-opacity": 0.18,
        },
        layout: {} },
      { id: LYR.zonesLine, type: "line", source: SRC.zones,
        paint: {
          "line-color": ["case",
            ["all", ["has", "sources"],
              ["!", ["in", "tpi", ["to-string", ["get", "sources"]]]]], "#4B93C5",
            "#B2182B"],
          "line-width": 0.7, "line-opacity": 0.6,
        },
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
      // Priority-zone pins: compact numbered dots — rank only; the side
      // list carries details and a click opens the full card as a popup.
      // Text collision hides crowded numbers (pins stay clickable).
      { id: LYR.zoneDot, type: "circle", source: SRC.zonePins,
        paint: {
          // Bright pins — the dark red class color reads as invisible
          // against the near-black basemap.
          "circle-radius": 9,
          "circle-color": ["match", ["get", "class"],
            "Critical", "#EF4444", "#FB923C"],
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 1.5,
        },
        layout: {} },
      { id: LYR.zoneNum, type: "symbol", source: SRC.zonePins,
        paint: { "text-color": "#FFFFFF" },
        layout: {
          "text-field": ["to-string", ["get", "rank"]],
          "text-size": 9,
          "text-font": ["Open Sans Bold"],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
        } },
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
    const onMapError = (e: { sourceId?: string; error?: unknown }) => {
      const sid = e?.sourceId;
      if (!sid) return;
      const pair = DYNAMIC_IMG.find(([, s]) => s === sid);
      if (!pair) return;
      const [lyr] = pair;
      const u = imgUrls.current[sid];
      // Only a missing file is remembered. A network or CORS failure is
      // tried again the next time the frame is wanted.
      if (u && isPermanentFrameFailure(e.error)) frameFailed.current.add(u);
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
      const l =
        key === "pTrigger"
          ? probFrame(bundle.manifest?.layers, options?.probHorizon ?? "24h", frameDate)
          : manifestRaster(bundle.manifest?.layers, key, frameDate);
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
    // L25: XGBoost P(trigger) probability frame — per-day raster under the
    // muni lines at 0.7, same seam as the other toggle rasters. TPI stays
    // the headline; this only paints when the manifest ships real frames.
    rasterToggle("pTrigger", SRC.prob, LYR.prob);

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
      overlay.opera);
    imgOverlay("night_lights", SRC.nl, LYR.nl, 0.85, LYR.muni,
      overlay.nightLights);
    imgOverlay("t_ml", SRC.tml, LYR.tml, 0.7, LYR.muni, overlay.tml);

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
        // A throw here says nothing about the file: drop the source and try
        // again the next time the frame is wanted.
        dropSource(map, SRC.tpiImg, LYR.tpiRaster);
      }
    }
    if (activePng && tpiUrl && !frameOk) {
      frameNote.current = `TPI frame unavailable — ${frameDate ? fmtDate(frameDate) : "this day"}`;
    } else if (tpiOn && !activePng) {
      // The manifest published no PNG for this day — say so instead of
      // leaving a bare basemap that reads as broken.
      frameNote.current = frameDate
        ? `No TPI frame published for ${fmtDate(frameDate)}`
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
    // Sets a source's data; the flood polygons also feed their dot layer.
    const setGeo = (src: string, fc: GeoJSON.FeatureCollection) => {
      type GeoSrc = { setData?: (d: GeoJSON.FeatureCollection) => void } | undefined;
      (map.getSource(src) as GeoSrc)?.setData?.(fc);
      if (src === SRC.flood) (map.getSource(SRC.floodPts) as GeoSrc)?.setData?.(featureCenters(fc));
    };
    // Several flood files in one source; the cache key is the URL list.
    const loadMergedFlood = (urls: (string | undefined)[]) => {
      const list = urls.filter((u): u is string => !!u);
      const key = list.join("|");
      const hit = geoData.current[SRC.flood];
      if (hit?.url === key) {
        if (hit.fc) setGeo(SRC.flood, hit.fc);
        return;
      }
      geoData.current[SRC.flood] = { url: key, fc: null };
      markLoading(SRC.flood, "flood extent", true);
      Promise.all(list.map(fetchGeo)).then((parts) => {
        const fc = standardFlood(parts);
        geoData.current[SRC.flood] = { url: key, fc };
        if (map.getSource(SRC.flood)) setGeo(SRC.flood, fc);
        markLoading(SRC.flood, "flood extent", false);
      });
    };
    const loadGeo = (src: string, label: string, url: string | undefined) => {
      if (!map.getSource(src)) return;
      if (!url) {
        geoData.current[src] = { url: "", fc: null };
        setGeo(src, EMPTY);
        return;
      }
      const hit = geoData.current[src];
      if (hit?.url === url) {
        if (hit.fc) setGeo(src, hit.fc);
        return; // already loaded (or fetch in flight — it will setData)
      }
      geoData.current[src] = { url, fc: null };
      markLoading(src, label, true);
      fetchGeo(url).then((fc) => {
        geoData.current[src] = { url, fc };
        if (map.getSource(src)) setGeo(src, fc ?? EMPTY);
        markLoading(src, label, false);
      });
    };
    const url = (key: string, fixed: string) =>
      geoUrl(bundle, caseDir, key, fixed);
    // Map chrome is optional: when the case publishes a products map, a file
    // it does not declare is not requested (the live case declares none of
    // these yet — no 404s). Cases without a products map keep the fixed name.
    const products = (bundle.products ?? bundle.manifest?.products) as
      | Record<string, unknown>
      | undefined;
    const chrome = (key: string, fixed: string) =>
      products && !(key in products) ? undefined : url(key, fixed);
    // Map chrome loads eagerly; overlays only when their tab/toggle asks.
    loadGeo(SRC.water, "permanent water", chrome("permanent_water", "geojson/permanent_water.geojson"));
    loadGeo(SRC.zones, "priority zones", chrome("priority_zones", "geojson/priority_zones.geojson"));
    // Unverified live run: municipalities flagged only by the TPI are held
    // back with the other risk outputs (observations stay).
    const zoneFilter = bundle.riskPaused
      ? ["!", ["all", ["has", "sources"],
          ["in", "tpi", ["to-string", ["get", "sources"]]],
          ["!", ["in", "dswx", ["to-string", ["get", "sources"]]]],
          ["!", ["in", "nisar", ["to-string", ["get", "sources"]]]]]]
      : null;
    for (const id of [LYR.zonesFill, LYR.zonesLine]) {
      try {
        if (map.getLayer(id)) map.setFilter(id, zoneFilter as never);
      } catch {
        // layer mid-teardown: nothing to filter
      }
    }
    loadGeo(SRC.muni, "boundaries", chrome("municipal_boundaries", "geojson/municipal_boundaries.geojson"));
    // With no tab context the caller drives flood/scars via showFlood (and
    // the nisar toggle); with a tab the overlayPlan decides; explicit
    // options.overlays replace both (see resolveOverlays).
    const wantFlood = overlay.flood;
    const wantScars = overlay.scars;
    const wantCatalog = overlay.catalog;
    if (wantFlood) {
      // Now: the OPERA DSWx-S1 candidates (products.flood_dswx) join the
      // NISAR ones in the same layer; "lower" confidence polygons (cropland,
      // seasonal water) are left out, as in the headline numbers.
      const dswx = products && typeof products.flood_dswx === "string"
        ? url("flood_dswx", products.flood_dswx as string) : undefined;
      const nisar = url("flood_confirmed", "geojson/flood_confirmed.geojson");
      if (dswx) loadMergedFlood([nisar, dswx]);
      else loadGeo(SRC.flood, "flood extent", nisar);
    }
    if (wantScars) loadGeo(SRC.scars, "landslide candidates", url("landslide_candidates", "geojson/landslide_candidates.geojson"));
    if (wantCatalog) loadGeo(SRC.catalog, "landslide catalog", url("landslide_catalog", "geojson/landslide_catalog.geojson"));
    set(SRC.places, bundle.places ?? EMPTY);

    vis(LYR.tpiRaster, usePng && frameOk);
    vis(LYR.fcastHatch, usePng && isForecast && frameOk);
    // With no tab context the caller drives flood/scars via showFlood (and
    // the nisar toggle); with a tab the overlayPlan decides.
    vis(LYR.floodFill, wantFlood);
    vis(LYR.floodLine, wantFlood);
    vis(LYR.floodDot, wantFlood);
    vis(LYR.scarsFill, wantScars);
    vis(LYR.scarsLine, wantScars);
    vis(LYR.catalog, wantCatalog);

    // Forecast label — pinned to the top edge of the frame on any forecast
    // day (v4: previsão sempre rotulada). The text names the
    // forecast source: "previsão perfeita" on replay, "NOAA GFS" live.
    if (!fcastMarker.current) {
      const el = document.createElement("div");
      el.className = "tp-forecast-label";
      fcastMarker.current = new Marker({ element: el, anchor: "top" });
    }
    fcastMarker.current.getElement().textContent =
      activePng && isGfsFrame(activePng)
        ? forecastChip(activePng, undefined)
        : (forecastSourceLabel(bundle.manifest?.forecast_source) ?? "forecast");
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
  }, [map, bundle, dayIndex, layers, showFlood, tab, activePng, overlayKey, options?.probHorizon]);

  // Priority-zone pins — top 20 by rank (matches the side list), anchored
  // at the polygon label point (real files are Polygons, not Points).
  // Compact numbered dots render as native layers so collisions declutter
  // instead of piling up; click opens the zone card as a popup.
  useEffect(() => {
    if (!map) return;
    const src = map.getSource(SRC.zonePins) as
      | { setData?: (d: GeoJSON.FeatureCollection) => void }
      | undefined;
    src?.setData?.({
      type: "FeatureCollection",
      // options.zoneMarkers === false: the caller draws its own pins.
      features: (zoneMarkers ? rankedZonePoints(bundle?.zones?.features, 20) : []).map(
        ({ zone: p, at }) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: at },
          properties: {
            rank: p.rank,
            name: p.name,
            class: p.class,
            hazard: p.hazard,
            tpi: p.tpi,
            area_km2: p.area_km2,
          },
        })
      ),
    });
  }, [map, bundle, zoneMarkers]);

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
      // Zone pins win over the raster read — the pin is the click target.
      const pinHits = map.queryRenderedFeatures(e.point, {
        layers: [LYR.zoneDot, LYR.zoneNum].filter((l) => map.getLayer(l)),
      });
      const zp = pinHits[0]?.properties as Record<string, unknown> | undefined;
      if (zp) {
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="tp-popup-body">` +
            `<strong>#${zp.rank} ${zp.name}</strong> ` +
            `<span>${String(zp.class ?? "").toUpperCase()}</span><br/>` +
            `${zp.hazard ?? ""} · TPI ${
              typeof zp.tpi === "number" ? zp.tpi.toFixed(2) : "—"
            }` +
            (typeof zp.area_km2 === "number"
              ? ` · ${zp.area_km2.toFixed(1)} km²`
              : "") +
            `</div>`
          )
          .addTo(map);
        return;
      }
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
  // One anchor derivation for both the pins and the side list (click-to-
  // zoom targets the same point). Zones without a finite anchor still
  // list — they just can't be zoomed to.
  return (bundle?.zones?.features ?? [])
    .map((f) => ({
      ...(f.properties as PriorityZone),
      at: zoneLabelPoint(f) ?? undefined,
    }))
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
