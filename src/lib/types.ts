// Types matching data/SCHEMA.md in r2l2pj/tipping-point-data — keep in sync.

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

export interface EventManifest {
  event: string;
  layers: ManifestLayer[];
}

export interface EventMetrics {
  event: string;
  flood?: { iou: number; f1: number; area_km2: number };
  alert?: { lead_hours_median: number; warned_before_pct: number };
  cloud?: { cloud_pct_during_event: number };
  impact?: { people_exposed: number; lights_out_pct: number };
}
