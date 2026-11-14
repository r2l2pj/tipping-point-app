// Types matching data/SCHEMA.md in r2l2pj/tipping-point-data — keep in sync.
// Additive v3 extensions (mode/data_dates/model/alerts) are marked optional.

export type LayerType = "cog" | "geojson" | "series";

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

export interface ManifestLayer {
  id: string;
  type: LayerType;
  path: string;
  legend?: "tpi" | "water" | "slides";
  source?: string;
  date?: string;
  bands?: string;
}

export interface NisarPass {
  date: string;
  track: string;
  note?: string;
}

// v3: mode + data_dates live on the manifest (per-case), not on events.json.
export interface EventManifest {
  event: string;
  mode?: "replay" | "live";
  bounds?: [number, number, number, number];
  updated_at?: string;
  data_dates?: Record<string, string | null | NisarPass[]>;
  layers: ManifestLayer[];
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
  data_dates?: Record<string, string | null | NisarPass[]>;
  manifest?: EventManifest;
  metrics?: EventMetrics;
  series?: SeriesDaily;
  zones?: GeoJSON.FeatureCollection;
  water?: GeoJSON.FeatureCollection;
  flood?: GeoJSON.FeatureCollection;
  scars?: GeoJSON.FeatureCollection;
  places?: GeoJSON.FeatureCollection;
}
