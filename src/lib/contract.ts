// Normalization layer for the v4 data contract. The contract itself is owned
// by tipping-point-data/data/SCHEMA.md; this module only adapts what the app
// reads: flat v4 shapes, the legacy nested mocks, asset path resolution, and
// case-id aliases (canonical underscore ids vs hyphen event ids).

import type { EventMetrics, ManifestLayer, NisarPass } from "./types";

export type ForecastSource = "perfect-forecast" | "geos-fp" | (string & {});
export type FloodSource = "nisar" | "opera" | "observed";
export type ProductMap = Record<string, string>;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

// Default TPI class cuts (upper bounds of Low/Moderate/High; Critical runs to
// 1). A manifest case node may override with `tpi_cuts`; components read the
// effective cuts from `LoadedCaseBundle.tpiCuts` and must not hard-code them.
export const TPI_CUTS = [0.2, 0.4, 0.6] as const;

// --- metrics ---------------------------------------------------------------

// Lead-time (retrospective) shapes — see docs/app-contract.md "lead time".
export type AnchorPrecision = "hour" | "date" | "mixed";
export interface LeadTimeHist {
  bin_h: number;
  from_h: number;
  counts: number[]; // counts[i] covers [from_h+i*bin_h, +bin_h); negatives allowed
}
export interface DamageAnchor {
  at: string; // ISO 8601 or YYYY-MM-DD
  source?: string;
  url?: string;
}
export interface LeadTimeAssumptions {
  imerg?: string;
  smap?: string;
  geos_fp?: string;
  quality?: "measured" | "placeholder";
  [k: string]: unknown;
}

// Real nested landslide_hit (fallback branch 19c56df): per-day hit stats
// sampled at the landslide inventory points. hit_pct/ge04_pct are authored
// 0-100; p50/p90/max are 0-1 fractions.
export interface LandslideHitDay {
  date: string;
  hit_pct: number;
  p50?: number;
  p90?: number;
  max?: number;
  ge04_pct?: number;
}
export interface LandslideHit {
  definition?: string;
  scale_m?: number;
  terrain_scale?: string;
  n_points?: number;
  note?: string;
  per_day?: LandslideHitDay[];
}

// metrics.json per event: flat keys (SCHEMA.md). All fields optional — the
// pipeline writes them from several steps and a case may ship a subset.
export interface MetricsV4 {
  event?: string;
  // Flood validation headline: like-for-like NISAR new flood vs OPERA
  // DSWx-S1 new flood (validation_method). Ratios 0-1, never rescaled.
  iou?: number;
  f1?: number;
  precision?: number;
  recall?: number;
  confusion?: { tp?: number; fp?: number; fn?: number };
  validation_method?: string;
  // Secondary: every OPERA water pixel incl. permanent/pre-existing water.
  iou_raw?: number;
  f1_raw?: number;
  precision_raw?: number;
  recall_raw?: number;
  confusion_raw?: { tp?: number; fp?: number; fn?: number; observed_px?: number };
  validation_method_raw?: string;
  opera_fn_diagnosis?: string;
  hls_iou?: number;
  hls_f1?: number;
  hls_method?: string;
  cloud_pct_source?: string;
  cloud_pct?: number;
  landslide_hit_pct?: number;
  landslide_hit?: LandslideHit; // nested form; flattened by flattenLandslideHit
  swath_coverage_pct?: number;
  water_km2?: number;
  threshold_db?: number;
  flood_bright_km2?: number;
  hand_validation?: number;
  flooded_km2_scope?: string; // e.g. "within NISAR swath"
  flood_top_clusters?: { area_km2: number; lat: number; lon: number; where?: string }[];
  hand_validation_radii?: Record<string, number>; // radius_m -> iou
  hand_best_radius_m?: number;
  people_critical?: number;
  people_flooded?: number;
  // Total AOI area above the TPI critical cut, and the day it refers to
  // (per-day series may replace the scalar — components must label the
  // date when it differs from the selected day).
  critical_km2?: number;
  critical_km2_date?: string;
  flooded_km2?: number;
  flood_source?: FloodSource;
  night_light_drop_pct?: number;
  lead_time_mean_h?: number;
  lead_time_median_h?: number;
  warned_before_pct?: number;
  rf_auc?: number;
  rule_auc?: number;
  feature_importance?: Record<string, number>;
  forecast_source?: ForecastSource;
  lead_time_iqr_h?: [number, number]; // [p25, p75] hours
  warned_24h_pct?: number;
  never_critical_pct?: number;
  n_points?: number; // damage points used
  anchor_precision?: AnchorPrecision;
  event_lead_h?: number; // event-level anchor lead
  official_warning_delta_h?: number | null; // + = TPI earlier than first official warning
  lead_time_assumptions?: LeadTimeAssumptions;
  lead_time_hist?: LeadTimeHist;
  critical_area_km2?: number;
  critical_area_with_damage_pct?: number;
  damage_anchor?: DamageAnchor;
}

// The UI-facing metrics view. Same keys as MetricsV4; every percent field is
// normalized to a 0-1 fraction regardless of the input scale (0-1 or 0-100).
// The raw payload stays available on CaseBundle.metrics, so the view carries
// no `raw` copy.
export type MetricsView = MetricsV4;

// Percent fields: a value >= 1 is read as a 0-100 scale and divided by 100 —
// *_pct fields are authored 0-100 (SCHEMA convention), so an authored 1 means
// 1%, not 100%. Only values < 1 get the 0-1 tolerance. Scores (iou/f1/aucs)
// are ratios by definition and pass through untouched.
const PCT_KEYS = [
  "cloud_pct",
  "landslide_hit_pct",
  "swath_coverage_pct",
  "hand_validation",
  "night_light_drop_pct",
  "warned_before_pct",
  "warned_24h_pct",
  "never_critical_pct",
  "critical_area_with_damage_pct",
] as const;

const pct = (v: unknown): number | undefined => {
  const n = num(v);
  return n === undefined ? undefined : n >= 1 ? n / 100 : n;
};

// Head counts: a raster join can leak fill values (~-2.3e38) or negatives;
// anything below zero or beyond a plausible world population is not data —
// undefined -> the card renders pending instead of a garbage number.
export const count = (v: unknown): number | undefined => {
  const n = num(v);
  return n === undefined || n < 0 || n > 8e9 ? undefined : n;
};

const LEGACY_SECTIONS = ["flood", "model", "alert", "cloud", "impact"] as const;

const section = (raw: Record<string, unknown>, key: string) =>
  isRecord(raw[key]) ? (raw[key] as Record<string, unknown>) : undefined;

// Accepts both the flat v4 metrics.json and the legacy nested mock
// (EventMetrics: flood/model/alert/cloud/impact sections) and returns one
// normalized view. Unknown flat keys pass through untouched (e.g. detailed
// sub-sections like landslide_ml).
export function toMetricsView(
  raw: EventMetrics | MetricsV4 | Record<string, unknown> | null | undefined
): MetricsView | undefined {
  if (!isRecord(raw)) return undefined;

  let view: MetricsView;
  if (LEGACY_SECTIONS.some((k) => isRecord(raw[k]))) {
    const flood = section(raw, "flood");
    const model = section(raw, "model");
    const alert = section(raw, "alert");
    const cloud = section(raw, "cloud");
    const impact = section(raw, "impact");
    view = {
      event: str(raw.event),
      iou: num(flood?.iou),
      f1: num(flood?.f1),
      flooded_km2: num(flood?.area_km2),
      rf_auc: num(model?.auc),
      lead_time_median_h: num(alert?.lead_hours_median),
      warned_before_pct: alert?.warned_before_pct as number | undefined,
      cloud_pct: cloud?.cloud_pct_during_event as number | undefined,
      people_critical: num(impact?.people_exposed),
      night_light_drop_pct: impact?.lights_out_pct as number | undefined,
      forecast_source: str(raw.forecast_source),
    };
  } else {
    view = { ...(raw as MetricsV4) };
  }

  for (const k of PCT_KEYS) view[k] = pct(view[k]);
  view.people_critical = count(view.people_critical);
  view.people_flooded = count(view.people_flooded);
  return view;
}

// Nested `landslide_hit` -> flat `landslide_hit_pct`: the event-day
// hit_pct — the per_day entry matching the case reference_date when known,
// else the last entry — normalized by the same *_pct rule (0-100 -> /100).
// The nested object passes through untouched. No-op when the view already
// carries a flat value or ships no hit data; needs the reference date, so
// callers run it post-normalization (getCaseBundle does).
export function flattenLandslideHit(
  view: MetricsView | undefined,
  referenceDate?: string
): MetricsView | undefined {
  if (!view || view.landslide_hit_pct !== undefined) return view;
  const days = view.landslide_hit?.per_day;
  if (!Array.isArray(days) || days.length === 0) return view;
  const day =
    (referenceDate !== undefined
      ? days.find((d) => isRecord(d) && d.date === referenceDate)
      : undefined) ?? days[days.length - 1];
  const hitPct = isRecord(day) ? pct(day.hit_pct) : undefined;
  return hitPct === undefined ? view : { ...view, landslide_hit_pct: hitPct };
}

// --- now@2 -----------------------------------------------------------------

// Forecast day fallback: now@2 layers may carry `forecast: true`; when the
// flag is absent, a `<id>_d<k>` suffix (k = 1..3) marks a forecast day.
export const FORECAST_DAY_RE = /_d[1-3]$/;

export interface NowLayer extends ManifestLayer {
  forecast: boolean;
}

// Normalized now/manifest.json node (schema "tipping-point/now@2").
// nisar_passes lives at the top level in v4; older synced data keeps it under
// data_dates — the view hoists it either way. The pipeline writes the file
// last and may publish `updated_at: null` mid-run.
export interface NowView {
  schema?: string;
  mode?: string;
  updated_at?: string;
  bounds?: [number, number, number, number];
  data_dates?: Record<string, unknown>;
  forecast_source?: ForecastSource;
  layers: NowLayer[];
  products: ProductMap;
  nisar_passes: NisarPass[];
}

export function toNowView(raw: unknown): NowView | undefined {
  if (!isRecord(raw)) return undefined;
  const dataDates = isRecord(raw.data_dates)
    ? (raw.data_dates as Record<string, unknown>)
    : undefined;
  const passes = Array.isArray(raw.nisar_passes)
    ? raw.nisar_passes
    : Array.isArray(dataDates?.nisar_passes)
      ? (dataDates.nisar_passes as unknown[])
      : [];

  const products: ProductMap = {};
  if (isRecord(raw.products)) {
    for (const [k, v] of Object.entries(raw.products)) {
      if (typeof v === "string") products[k] = v;
    }
  }

  return {
    schema: str(raw.schema),
    mode: str(raw.mode),
    updated_at: str(raw.updated_at),
    bounds: raw.bounds as NowView["bounds"],
    data_dates: dataDates,
    forecast_source: str(raw.forecast_source),
    layers: (Array.isArray(raw.layers) ? raw.layers : [])
      .filter(isRecord)
      .map((l) => ({
        ...(l as unknown as ManifestLayer),
        forecast:
          l.forecast === true ||
          (l.forecast === undefined && FORECAST_DAY_RE.test(str(l.id) ?? "")),
      })),
    products,
    nisar_passes: passes.filter(isRecord) as unknown as NisarPass[],
  };
}

// now/summary.json (SCHEMA.md): written last by each live run.
export interface NowSummary {
  generated_at?: string;
  critical_km2?: { slide?: number; flood?: number; any?: number };
  people_critical?: number;
  people_exposed?: number;
  forecast_source?: ForecastSource;
  // v1: one flat map (union of hazards). v2 (lead-live 2026-11-15): one map
  // per hazard, { landslide: {...}, flood: {...} }. Read through liveClasses.
  classes_km2?: Record<string, number | Record<string, number>>;
  data_dates?: Record<string, string>;
}

// now/alerts.json: candidate alert cards for the live bundle.
export interface NowAlertCandidate {
  class?: number;
  label?: string;
  // "flood" | "landslide" (lead-live). Absent in runs before 2026-11-15.
  hazard?: string;
  centroid?: [number, number];
  pixels?: number;
  hold?: boolean;
  // lead-live 2026-11-15: TPI alerts carry kind "tpi", the place, the area
  // and the day ("today" | "d1").
  kind?: string;
  municipality?: string;
  uf?: string;
  area_km2?: number;
  bbox?: [number, number, number, number];
  when?: string;
  // `active` entries (lead-live): when the area was first alerted and last
  // confirmed by a run.
  first_issued_at?: string;
  last_confirmed_at?: string;
  basis_note?: string;
}

// Satellite flood candidates grouped per source and municipality: shown as
// observations, never as alerts.
export interface NowObserved {
  kind?: string; // "observed"
  hazard?: string; // "flood"
  label?: string;
  source?: string; // "nisar-gcov", "opera-dswx", ...
  acquired?: string;
  municipality?: string;
  uf?: string;
  area_km2?: number;
  people?: number;
  polygons?: number;
  confidence?: string; // "standard" | "lower" (lead-live, 2026-11-15)
}

export interface NowAlertsFile {
  schema?: string;
  generated_at?: string;
  candidates?: NowAlertCandidate[];
  // Every current High/Critical area-alert (what the public page shows);
  // `notifications` = what was sent this run (send rules: upgrades only,
  // one per 6 h, quiet hours).
  active?: NowAlertCandidate[];
  notifications?: NowAlertCandidate[];
  observed?: NowObserved[];
  // true: the run did not pass its checks; candidates is empty.
  paused?: boolean;
  paused_reason?: string;
}

// --- case ids --------------------------------------------------------------

// Canonical ids are the underscore forms (root-manifest keys, per D1); the
// hyphen forms are event ids / directory names kept as aliases.
const CASE_ALIASES: Record<string, string> = {
  "rs-2024-05": "rs_2024",
  rs_2024: "rs-2024-05",
  "wa-2025-12": "wa_2025",
  wa_2025: "wa-2025-12",
};

// The other registered form of a case id (either direction), or undefined
// when the id isn't one of the known pairs.
export const caseAlias = (id: string): string | undefined => CASE_ALIASES[id];

// Canonical (underscore) form of a known case id; unknown ids pass through
// unchanged.
export const canonicalCaseId = (id: string): string =>
  id.includes("_") ? id : (CASE_ALIASES[id] ?? id);

// --- asset paths -----------------------------------------------------------

// Resolves a manifest path against the data base URL.
// - null/undefined/""      -> undefined (asset absent)
// - absolute http(s)://    -> passthrough
// - bucket-relative key    -> base/caseDir/key; keys already starting with
//   caseDir (root-manifest style, e.g. "wa-2025-12/png/...") are not doubled.
export function resolveAsset(
  base: string,
  caseDir: string,
  path: string | null | undefined
): string | undefined {
  if (path == null || path === "") return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const cleanBase = base.replace(/\/+$/, "");
  const rel = path.replace(/^\.?\//, "");
  const dir = caseDir.replace(/^\/+|\/+$/g, "");
  const key = dir && !rel.startsWith(`${dir}/`) ? `${dir}/${rel}` : rel;
  return cleanBase ? `${cleanBase}/${key}` : key;
}

// --- forecast_source labels -------------------------------------------------

export const FORECAST_SOURCE_LABELS: Record<string, string> = {
  "perfect-forecast": "perfect forecast", // replay cases
  // Live runs before L30 (2026-11-15). The only forecast input now is NOAA
  // GFS; the old source is not named on screen.
  "geos-fp": "older forecast run",
  "noaa-gfs": "NOAA GFS", // L22 issued-forecast replay frames
};

// UI label for a forecast_source value; unknown sources pass through
// verbatim, missing source -> undefined.
export const forecastSourceLabel = (
  source: string | null | undefined
): string | undefined =>
  source == null ? undefined : (FORECAST_SOURCE_LABELS[source] ?? source);

// --- live summary: Critical area and classes per hazard ---------------------
//
// Summary v1: classes_km2 flat (both hazards), critical_km2.<hazard> =
// Critical only. Summary v2 (lead-live, 2026-11-15): classes_km2 per hazard
// and critical_km2.<hazard> = High + Critical. The screen says "Critical
// area", so v2 is read from the per-hazard "Crítico" class.

const HAZARD_KEYS: Record<"slide" | "flood", string[]> = {
  slide: ["landslide", "slide"],
  flood: ["flood"],
};

const isNumMap = (v: unknown): v is Record<string, number> =>
  isRecord(v) && Object.values(v).every((x) => typeof x === "number");

// Area by class for the hazard (v2), or the flat union map (v1).
export function liveClasses(
  summary: NowSummary | undefined,
  hazard: "slide" | "flood"
): Record<string, number> | undefined {
  const c = summary?.classes_km2;
  if (!isRecord(c)) return undefined;
  for (const key of HAZARD_KEYS[hazard]) {
    if (isNumMap(c[key])) return c[key] as Record<string, number>;
  }
  return isNumMap(c) ? c : undefined;
}

// v2: classes_km2 carries one map per hazard.
export const liveSummaryV2 = (summary: NowSummary | undefined): boolean => {
  const c = summary?.classes_km2;
  return isRecord(c) && Object.values(HAZARD_KEYS).flat().some((k) => isNumMap(c[k]));
};

// Critical-only area of the hazard; undefined when not published. The v1
// union `any` is the fallback only for v1 (in v2 `any` counts High too).
export function liveCriticalKm2(
  summary: NowSummary | undefined,
  hazard: "slide" | "flood"
): number | undefined {
  const c = summary?.classes_km2;
  const perHazard = isRecord(c) && HAZARD_KEYS[hazard].some((k) => isNumMap(c[k]));
  if (perHazard) {
    const v = liveClasses(summary, hazard)?.["Crítico"] ?? liveClasses(summary, hazard)?.["Critical"];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  }
  const v = summary?.critical_km2?.[hazard] ?? summary?.critical_km2?.any;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
