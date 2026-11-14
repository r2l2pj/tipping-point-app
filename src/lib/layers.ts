// Pure map-layer helpers — no maplibre import so the module stays testable
// under `bun test` (node). The MapLibre glue lives in components/MapLayers.tsx.

import { readCogPixel, readCogRST, type CogRSTUrls } from "./cog";
import { resolveAsset } from "./contract";
import { rstFor } from "./tpi";
import type { DayPoint, ManifestLayer, PriorityZone } from "./types";

export type TabKey = "alert" | "radar" | "validation" | "impact";

// --- forecast frames --------------------------------------------------------

// Mirrors contract.toNowView: an explicit `forecast` flag wins; when the flag
// is absent a `<id>_d<k>` suffix (k = 1..3) marks a forecast frame — so
// tpi_slide_d2 is forecast, tpi_slide_d0 is not, and forecast:false on a *_d2
// layer keeps it observed.
const FORECAST_DAY_RE = /_d[1-3]$/;

export function isForecastLayer(l: {
  id?: string;
  forecast?: boolean;
}): boolean {
  return (
    l.forecast === true ||
    (l.forecast === undefined && FORECAST_DAY_RE.test(l.id ?? ""))
  );
}

// --- per-tab dynamic overlays ------------------------------------------------
//
// Which data overlays each side-panel tab turns on (project doc "Abas e
// componentes"): Alerta shows the TPI frame only; Radar adds confirmed flood
// polygons and landslide candidates; Acertamos? adds catalog points and the
// OPERA validation raster; Impacto adds the night-lights raster. TPI itself
// stays user-toggled on every tab. Plain serializable object.
export interface OverlayPlan {
  tpi: boolean;
  floodPolygons: boolean;
  landslideCandidates: boolean;
  catalogPoints: boolean;
  operaValidation: boolean;
  nightLights: boolean;
  // Data layers the tab adds beyond user toggles — they count toward the
  // two-layer budget (viz rule 5), so toggles get max(0, 2 - count). TPI is
  // excluded: it is itself a toggle.
  count: number;
}

export function overlayPlan(tab?: TabKey | string): OverlayPlan {
  const plan = {
    tpi: true,
    floodPolygons: tab === "radar",
    landslideCandidates: tab === "radar",
    catalogPoints: tab === "validation",
    operaValidation: tab === "validation",
    nightLights: tab === "impact",
  };
  return {
    ...plan,
    count:
      Number(plan.floodPolygons) +
      Number(plan.landslideCandidates) +
      Number(plan.catalogPoints) +
      Number(plan.operaValidation) +
      Number(plan.nightLights),
  };
}

// --- priority-zone label anchors ---------------------------------------------
//
// Real priority_zones files are Polygon features (rs_2024 ~4.8k, wa_2025
// ~1.5k) — never Points. A marker needs one anchor: properties.label_lon/
// label_lat win when present and finite; a Point uses its own coordinates;
// a Polygon/MultiPolygon anchors at the centroid of its largest exterior ring
// (shoelace area). Anything without finite coords returns null — the caller
// must skip it (invalid LngLat would crash the map).

const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const ringArea = (ring: number[][]): number => {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
};

const ringCentroid = (ring: number[][]): [number, number] | null => {
  // Vertex mean; the last vertex duplicates the first, so drop it.
  const pts = ring.length > 1 ? ring.slice(0, -1) : ring;
  if (pts.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const [px, py] of pts) {
    if (!finite(px) || !finite(py)) return null;
    x += px;
    y += py;
  }
  return [x / pts.length, y / pts.length];
};

export function zoneLabelPoint(
  feature: GeoJSON.Feature
): [number, number] | null {
  const p = feature.properties as Record<string, unknown> | null;
  if (p && finite(p.label_lon) && finite(p.label_lat)) {
    return [p.label_lon, p.label_lat];
  }
  const g = feature.geometry;
  if (!g) return null;
  if (g.type === "Point") {
    const [lon, lat] = g.coordinates as number[];
    return finite(lon) && finite(lat) ? [lon, lat] : null;
  }
  const exteriors: number[][][] =
    g.type === "Polygon"
      ? [g.coordinates[0]]
      : g.type === "MultiPolygon"
        ? g.coordinates.map((poly) => poly[0])
        : [];
  const largest = exteriors
    .filter((r): r is number[][] => Array.isArray(r) && r.length > 0)
    .sort((a, b) => ringArea(b) - ringArea(a))[0];
  return largest ? ringCentroid(largest) : null;
}

// Ranked anchors for zone markers — worst offenders first, capped so a
// 5k-polygon case never becomes 5k DOM nodes.
export function rankedZonePoints(
  features: GeoJSON.Feature[] | undefined,
  max = 10
): { zone: PriorityZone; at: [number, number] }[] {
  return (features ?? [])
    .map((f) => ({
      zone: f.properties as PriorityZone,
      at: zoneLabelPoint(f),
    }))
    .filter((x): x is { zone: PriorityZone; at: [number, number] } =>
      x.at !== null &&
      typeof x.zone?.rank === "number")
    .sort((a, b) => a.zone.rank - b.zone.rank)
    .slice(0, max);
}

// Max data layers on the map at once (viz rule 5).
export const MAX_DATA_LAYERS = 2;

export const toggleBudget = (tab?: TabKey | string): number =>
  Math.max(0, MAX_DATA_LAYERS - overlayPlan(tab).count);

// Enabled-toggle bookkeeping for the layer budget. Entries whose raster is
// not available in the current bundle are dead — they paint nothing and must
// not consume a budget slot (a dead entry evicting a live layer would blank
// the map). Returns the queue to keep (oldest-first) and every key to switch
// off: dead entries plus the oldest live ones over budget.
export function capToggleQueue<K extends string>(
  queue: readonly K[],
  budget: number,
  available: (key: K) => boolean
): { queue: K[]; off: K[] } {
  const dead = queue.filter((k) => !available(k));
  const live = queue.filter((k) => available(k));
  const evicted = live.slice(0, Math.max(0, live.length - budget));
  return { queue: live.slice(evicted.length), off: [...dead, ...evicted] };
}

// --- município lookup --------------------------------------------------------

function ringContains(
  ring: GeoJSON.Position[],
  lon: number,
  lat: number
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function polygonContains(
  rings: GeoJSON.Position[][],
  lon: number,
  lat: number
): boolean {
  if (!rings.length || !ringContains(rings[0], lon, lat)) return false;
  return !rings.slice(1).some((hole) => ringContains(hole, lon, lat));
}

// Name of the first municipality polygon containing (lon, lat), for the map
// click popup. Falls back through the common property spellings
// (name / nome / NM_MUN); returns undefined when no polygon contains the
// point so the caller can fall back to nearestPlace().
export function pointInPolygons(
  fc: GeoJSON.FeatureCollection | undefined,
  lon: number,
  lat: number
): string | undefined {
  for (const f of fc?.features ?? []) {
    const g = f.geometry;
    if (!g) continue;
    const hit =
      g.type === "Polygon"
        ? polygonContains(g.coordinates, lon, lat)
        : g.type === "MultiPolygon"
          ? g.coordinates.some((p) => polygonContains(p, lon, lat))
          : false;
    if (!hit) continue;
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const name = p.name ?? p.nome ?? p.NM_MUN;
    if (name != null) return String(name);
  }
  return undefined;
}

// --- asset URLs --------------------------------------------------------------

// Manifest png/cog paths are bucket-relative; the bucket is served at /data.
// resolveAsset passes through gs:// and http(s) URLs and does not double
// paths that already carry the case dir.
export const assetUrl = (
  caseDir: string,
  p: string | null | undefined
): string | undefined => resolveAsset("/data", caseDir, p);

// --- toggle-layer raster availability ---------------------------------------
//
// A toggle layer only paints when the manifest ships a real raster for it —
// never synthetic data dressed up as a NASA product. Manifest layers match
// by id prefix (imerg_* / smap_* / nisar_* / tpi_*); nisar excludes the
// nisar_pre/nisar_post pair, which backs the radar before/after swipe.
export type ToggleLayerKey = "tpiSlide" | "tpiFlood" | "imerg" | "smap" | "nisar";

const TOGGLE_PREFIX: Record<ToggleLayerKey, string> = {
  tpiSlide: "tpi_slide",
  tpiFlood: "tpi_flood",
  imerg: "imerg_",
  smap: "smap_",
  nisar: "nisar_",
};

const NISAR_SWIPE_IDS = new Set(["nisar_pre", "nisar_post"]);

// First manifest layer backing a toggle, preferring one stamped with the
// given day date. A png or cog both count as a real raster (resolved through
// assetUrl); callers that need a paintable image still require l.png.
export function manifestRaster(
  layers: ManifestLayer[] | undefined,
  key: ToggleLayerKey,
  date?: string
): ManifestLayer | undefined {
  const prefix = TOGGLE_PREFIX[key];
  const matches = (layers ?? []).filter(
    (l) =>
      l.id.startsWith(prefix) &&
      !(key === "nisar" && NISAR_SWIPE_IDS.has(l.id)) &&
      (l.png || l.cog)
  );
  return matches.find((l) => l.date === date) ?? matches[0];
}

export function layerAvailable(
  bundle: { manifest?: { layers?: ManifestLayer[] } } | undefined,
  key: ToggleLayerKey
): boolean {
  return manifestRaster(bundle?.manifest?.layers, key) !== undefined;
}

// --- BRT date formatting ------------------------------------------------------
//
// All over-map dates are shown in America/Sao_Paulo (viz rule 1).
// Date-only values ("2026-11-14") are calendar dates — they render as-is,
// not converted (a UTC-midnight read would shift them back a day in BRT).
const BRT = "America/Sao_Paulo";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const dateOnly = DATE_ONLY_RE.test(iso);
  const d = new Date(dateOnly ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : BRT,
  });
}

// Local time of day in Brasília — fmtDateTime("2026-11-15T05:00:00Z") -> "02:00".
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: BRT,
  });
}

// A data_dates value rendered for the popup/panels: date-only values get the
// long form, full timestamps also show the Brasília clock time.
export function fmtDataDate(iso?: string | null): string {
  if (!iso) return "—";
  return iso.includes("T") ? `${fmtDate(iso)} ${fmtDateTime(iso)}` : fmtDate(iso);
}

// --- doc v4 palettes ------------------------------------------------------------
//
// Pre-painted PNGs already carry these colors; the consts back legends and
// any client-rendered fallback. Never a coherence_drop layer (wa_2025 GUNW
// dropped — landslide candidates come from optical, always "candidates").

// TPI classes — ColorBrewer YlOrRd.
export const TPI_STOPS: [number, string][] = [
  [0.0, "#FFFFB2"],
  [0.2, "#FECC5C"],
  [0.4, "#FD8D3C"],
  [0.6, "#BD0026"],
];

// T_ML Random-Forest probability: continuous YlOrRd 0 -> 1.
export const TML_STOPS = TPI_STOPS;

// OPERA validation raster: both / NISAR-only / OPERA-only / cloud (hatched).
export const OPERA = {
  both: "#2166AC",
  nisarOnly: "#92C5DE",
  operaOnly: "#F4A582",
  cloud: "#BDBDBD",
} as const;

// Night-lights drop (VIIRS Black Marble): viridis 0 -> 100%.
export const VIRIDIS: [number, string][] = [
  [0.0, "#440154"],
  [0.25, "#3B528B"],
  [0.5, "#21918C"],
  [0.75, "#5EC962"],
  [1.0, "#FDE725"],
];

// --- COG pixel seam -----------------------------------------------------------

export interface PixelValues {
  tpi: number | null;
  r: number | null;
  s: number | null;
  t: number | null;
  provenance?: "gee" | "cog";
}

// COG pixel seam for the click popup. Reads the TPI value out of the frame's
// COG (multiband series resolve the band by ctx.day.date — GDAL DESCRIPTION
// or the bandOrder day list); r/s/t come from the case's COG-only score
// layers (r_series / s_series / t_slide / t_flood) when published.
//
// Contract: null without a cog URL or when the TPI read fails — the popup
// then keeps the "day estimate" fallback. Partial r/s/t failures merge over
// the estimate, so "COG pixel read" is only claimed when the TPI value is a
// real range-read.
export async function resolvePixelValues(
  cogUrl: string | undefined,
  lon: number,
  lat: number,
  ctx?: {
    day?: DayPoint;
    rainP95Mm?: number;
    tpi?: number;
    bandOrder?: string[];
    rstUrls?: CogRSTUrls;
    caseId?: string;
    kind?: "slide" | "flood";
  }
): Promise<PixelValues | null> {
  if (ctx?.caseId && ctx.day?.date) {
    try {
      const res = await fetch("/api/point?" + new URLSearchParams({
        case: ctx.caseId,
        date: ctx.day.date,
        lat: String(lat),
        lon: String(lon),
      }));
      if (res.ok) {
        const { values } = await res.json();
        const keys = ["tpi_slide", "tpi_flood", "r", "s", "t_slide", "t_flood"] as const;
        if (values && typeof values === "object" && !Array.isArray(values) &&
          keys.every((key) => values[key] === null ||
            (typeof values[key] === "number" && Number.isFinite(values[key])))) {
          return {
            tpi: ctx.kind === "slide" ? values.tpi_slide : ctx.kind === "flood"
              ? values.tpi_flood : values.tpi_slide ?? values.tpi_flood,
            r: values.r,
            s: values.s,
            t: ctx.kind === "flood" ? values.t_flood ?? values.t_slide
              : values.t_slide ?? values.t_flood,
            provenance: "gee",
          };
        }
      }
    } catch {}
  }
  if (!cogUrl) return null;
  const opts = { date: ctx?.day?.date, bandOrder: ctx?.bandOrder };
  const tpi = await readCogPixel(cogUrl, lon, lat, opts);
  if (tpi === null) return null;

  const est = rstFor(
    ctx?.day,
    ctx?.rainP95Mm,
    ctx?.tpi ?? ctx?.day?.tpi ?? tpi
  );
  const { r, s, t } = ctx?.rstUrls
    ? await readCogRST(ctx.rstUrls, lon, lat, opts)
    : { r: null, s: null, t: null };
  return { tpi, r: r ?? est.r, s: s ?? est.s, t: t ?? est.t, provenance: "cog" };
}

// --- lazy geojson loading ----------------------------------------------------
//
// Whole geojson layers no longer ride inside the bundle/RSC payload (they
// made the home page ~18 MB). The client resolves each product's URL from the
// bundle's products map and fetches it lazily in the browser; a module-level
// promise cache means the map source and any panel counting the same file
// share ONE transfer. fetchGeo resolves null on 404/network so an absent
// product just paints nothing (pending[] is the honest marker).

const geoCache = new Map<string, Promise<GeoJSON.FeatureCollection | null>>();

export function fetchGeo(
  url: string
): Promise<GeoJSON.FeatureCollection | null> {
  let p = geoCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) =>
        r.ok ? (r.json() as Promise<GeoJSON.FeatureCollection>) : null
      )
      .catch(() => null);
    geoCache.set(url, p);
  }
  return p;
}

type ProductsLike = Record<string, string | null | undefined> | undefined;

// URL for a geojson product: products map wins (explicit null = declared
// absent -> undefined, never fetched), fixed filename as fallback.
export function geoUrl(
  bundle:
    | {
        products?: ProductsLike;
        manifest?: { products?: ProductsLike };
      }
    | null
    | undefined,
  caseDir: string,
  key: string,
  fixed: string
): string | undefined {
  const products = bundle?.products ?? bundle?.manifest?.products;
  const declared = products?.[key];
  if (declared === null) return undefined;
  return assetUrl(caseDir, declared ?? fixed);
}

// --- resilient map sources ---------------------------------------------------
//
// A 404'd PNG/geojson must never take the dashboard down. dropSource removes
// a source and its layer pair, swallowing every MapLibre throw; safeImageUpdate
// does the same for ImageSource.updateImage, which crashes when the source's
// earlier image failed to load ("Cannot read properties of undefined
// (reading 'getImage')"). Both return whether they succeeded.

type SourceOps = {
  getSource(id: string): unknown;
  removeSource(id: string): void;
  getLayer(id: string): unknown;
  removeLayer(id: string): void;
};

export function dropSource(
  map: SourceOps,
  srcId: string,
  layerId?: string
): void {
  try {
    if (layerId && map.getLayer(layerId)) map.removeLayer(layerId);
  } catch {
    // layer may already be gone or mid-teardown — fine either way
  }
  try {
    if (map.getSource(srcId)) map.removeSource(srcId);
  } catch {
    // source teardown racing a failed load — nothing more to clean
  }
}

export function safeImageUpdate(
  src: { updateImage(spec: unknown): void } | undefined,
  spec: { url: string; coordinates: unknown }
): boolean {
  if (!src) return false;
  try {
    src.updateImage(spec);
    return true;
  } catch {
    return false;
  }
}
