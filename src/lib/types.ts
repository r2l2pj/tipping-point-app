// Types matching data/SCHEMA.md in r2l2pj/tipping-point-data — keep in sync.
// Additive v3 extensions (mode/data_dates/model/alerts) are marked optional.

import type {
  MetricsView,
  NowAlertsFile,
  NowSummary,
  ProductMap,
} from "./contract";

export type LayerType = "cog" | "geojson" | "series" | "png";

// v4 manifest layer: pre-rendered EPSG:3857 PNG for display + COG for
// download/reproducibility. `bounds` [w,s,e,n] locates the PNG on the map.
// Legacy v3 fields (type/path/source/bands) stay optional for data synced
// from older pipeline output.
export interface ManifestLayer {
  id: string;
  date?: string;
  png?: string;
  cog?: string;
  asset?: string | null;
  bounds?: [number, number, number, number];
  legend?: string[] | "tpi" | "water" | "slides";
  type?: LayerType;
  path?: string;
  source?: string;
  bands?: string;
  // Forecast-day flag (now/ and replay forecast overlays); when absent a
  // `<id>_d[1-3]` suffix marks the forecast day — see FORECAST_DAY_RE.
  forecast?: boolean;
}

export interface NisarPass {
  date: string;
  track: string;
  note?: string;
}

export type DataDates = Record<string, string | null | NisarPass[]>;

// v4 root manifest.json — the single contract between data and front. Case
// keys are the canonical underscore ids (rs_2024, wa_2025, now); each node
// carries its hyphen event id and explicit asset paths — the app never
// derives paths from keys or event ids.
// { updated_at, cases: { <id>: { event_id, mode, bounds, layers, metrics,
//   products, forecast_source, data_dates },
//   now: { mode: "live", bounds, data_dates } } }
export interface ManifestCase {
  event_id?: string;
  mode?: "replay" | "live";
  bounds?: [number, number, number, number];
  updated_at?: string;
  data_dates?: DataDates;
  layers?: ManifestLayer[];
  metrics?: string;
  products?: ProductMap;
  forecast_source?: string;
  // TPI class cuts overriding the contract default (contract.TPI_CUTS,
  // [0.2, 0.4, 0.6]) — upper bounds of Low/Moderate/High.
  tpi_cuts?: number[];
}

export interface RootManifest {
  updated_at?: string;
  cases: Record<string, ManifestCase>;
}

export interface EventIndexEntry {
  id: string;
  title: string;
  bbox: [number, number, number, number]; // [w, s, e, n]
  reference_date: string;
  layers: string[];
}

export interface EventsIndex {
  schema: string;
  events: EventIndexEntry[];
}

// Resolved per-case manifest entry (v4 root manifest or legacy per-case file).
export interface EventManifest {
  event: string;
  event_id?: string;
  mode?: "replay" | "live";
  bounds?: [number, number, number, number];
  updated_at?: string;
  data_dates?: DataDates;
  layers: ManifestLayer[];
  products?: ProductMap;
  forecast_source?: string;
  tpi_cuts?: number[];
}

export interface EventMetrics {
  event: string;
  flood?: { iou: number; f1: number; area_km2: number };
  model?: { auc: number; threshold: number; precision: number; recall: number };
  alert?: { lead_hours_median: number; warned_before_pct: number };
  cloud?: { cloud_pct_during_event: number };
  impact?: { people_exposed: number; lights_out_pct: number };
}

export type DayKind = "observed" | "forecast" | "hindcast";

export interface DayPoint {
  date: string;
  offset: number; // days relative to reference_date (0 = event/today)
  kind: DayKind;
  imerg_mm: number;
  smap: number; // 0–1
  tpi: number; // 0–1
  river_m?: number | null;
}

export interface SeriesDaily {
  event: string;
  reference_date: string;
  rain_p95_mm?: number;
  tpi_threshold?: number;
  days: DayPoint[];
}

export interface PriorityZone {
  rank: number;
  name: string;
  tpi: number;
  class: "Low" | "Moderate" | "High" | "Critical";
  hazard: string;
  area_km2: number;
  // null when the GPW population join is absent from the pipeline output.
  people: number | null;
  // Label anchor derived client-side (zoneLabelPoint) — the list uses it
  // for click-to-zoom; absent when the feature has no finite anchor.
  at?: [number, number];
}

export type AlertLevel = "watch" | "warning" | "emergency";

export interface Alert {
  id: string;
  area: string;
  hazard: "landslide" | "flood" | string;
  level: AlertLevel;
  certainty: "low" | "medium" | "high" | string;
  valid_from: string;
  valid_to: string;
  guidance: string;
  region?: string;
  rain?: string;
  soil?: string;
  forecast?: string;
  data_dates?: Record<string, string>;
  map?: string;
}

export interface AlertsFile {
  schema: string;
  alerts: Alert[];
}

// Everything the dashboard needs for one case, loaded server-side.
// `bbox` and `reference_date` derive from the contract (A10): bbox = the case
// node's `bounds` ?? caller arg ?? the events.json entry `bbox` — `bounds` is
// required by SCHEMA, so getCaseBundle throws when nothing supplies one.
// reference_date = caller arg ?? manifest.updated_at (first 10 chars) ??
// data_dates.observed ?? latest non-forecast layer.date ??
// series.reference_date ?? the events.json entry date — absent only when the
// case ships none of those.
export interface CaseBundle {
  id: string;
  title: string;
  mode: "replay" | "live";
  bbox: [number, number, number, number];
  reference_date?: string;
  updated_at?: string;
  data_dates?: DataDates;
  manifest?: EventManifest;
  metrics?: EventMetrics;
  metricsView?: MetricsView;
  summary?: NowSummary;
  swot?: unknown;
  catalog?: GeoJSON.FeatureCollection;
  municipalities?: GeoJSON.FeatureCollection;
  products?: ProductMap;
  nowAlerts?: NowAlertsFile;
  series?: SeriesDaily;
  zones?: GeoJSON.FeatureCollection;
  water?: GeoJSON.FeatureCollection;
  flood?: GeoJSON.FeatureCollection;
  scars?: GeoJSON.FeatureCollection;
  places?: GeoJSON.FeatureCollection;
  // Contract outputs that were absent at load time (L14): 'metrics',
  // 'series', and product ids declared in the products map but missing
  // from storage. Sorted; components render "pending" markers off this —
  // the loader never fabricates values for unshipped outputs.
  pending?: string[];
}
