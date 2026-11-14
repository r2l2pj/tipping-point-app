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
  bounds?: [number, number, number, number];
  legend?: string[] | "tpi" | "water" | "slides";
  type?: LayerType;
  path?: string;
  source?: string;
  bands?: string;
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
  people: number;
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
export interface CaseBundle {
  id: string;
  title: string;
  mode: "replay" | "live";
  bbox: [number, number, number, number];
  reference_date: string;
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
}
