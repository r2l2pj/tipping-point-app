// Pure map-layer helpers — no maplibre import so the module stays testable
// under `bun test` (node). The MapLibre glue lives in components/MapLayers.tsx.

import { resolveAsset } from "./contract";
import { rstFor } from "./tpi";
import type { DayPoint } from "./types";

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
}

export function overlayPlan(tab?: TabKey | string): OverlayPlan {
  return {
    tpi: true,
    floodPolygons: tab === "radar",
    landslideCandidates: tab === "radar",
    catalogPoints: tab === "validation",
    operaValidation: tab === "validation",
    nightLights: tab === "impact",
  };
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
  tpi: number;
  r: number;
  s: number;
  t: number;
}

// Seam for the real COG pixel reader (geotiff.js lands in src/lib separately
// and swaps INSIDE this function — callers don't change). Until then: null
// without a cog URL, else the rstFor() day-level approximation so the async
// popup path is exercised end to end.
export async function resolvePixelValues(
  cogUrl: string | undefined,
  lon: number,
  lat: number,
  ctx?: { day?: DayPoint; rainP95Mm?: number; tpi?: number }
): Promise<PixelValues | null> {
  void lon;
  void lat;
  if (!cogUrl) return null;
  const tpi = ctx?.tpi ?? ctx?.day?.tpi;
  if (tpi === undefined) return null;
  const { r, s, t } = rstFor(ctx?.day, ctx?.rainP95Mm, tpi);
  return { tpi, r, s, t };
}
