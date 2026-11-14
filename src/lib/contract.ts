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

// metrics.json per event: flat keys (SCHEMA.md). All fields optional — the
// pipeline writes them from several steps and a case may ship a subset.
export interface MetricsV4 {
  event?: string;
  iou?: number;
  f1?: number;
  cloud_pct?: number;
  landslide_hit_pct?: number;
  swath_coverage_pct?: number;
  hand_validation?: number;
  flooded_km2_scope?: string; // e.g. "within NISAR swath"
  flood_top_clusters?: { area_km2: number; lat: number; lon: number; where?: string }[];
  hand_validation_radii?: Record<string, number>; // radius_m -> iou
  hand_best_radius_m?: number;
  people_critical?: number;
  people_flooded?: number;
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
  return view;
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
  classes_km2?: Record<string, number>;
  data_dates?: Record<string, string>;
}

// now/alerts.json: candidate alert cards for the live bundle.
export interface NowAlertCandidate {
  class?: number;
  label?: string;
  centroid?: [number, number];
  pixels?: number;
  hold?: boolean;
}

export interface NowAlertsFile {
  schema?: string;
  candidates?: NowAlertCandidate[];
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
  "geos-fp": "GEOS-FP", // live now/ runs
};

// UI label for a forecast_source value; unknown sources pass through
// verbatim, missing source -> undefined.
export const forecastSourceLabel = (
  source: string | null | undefined
): string | undefined =>
  source == null ? undefined : (FORECAST_SOURCE_LABELS[source] ?? source);
