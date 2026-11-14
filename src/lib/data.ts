// Server-side loader for the static data contract (public/data/).
// Files are synced from r2l2pj/tipping-point-data by `bun run sync:data`.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  AlertsFile,
  CaseBundle,
  EventManifest,
  EventMetrics,
  EventsIndex,
  SeriesDaily,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

async function readJson<T>(...parts: string[]): Promise<T> {
  const raw = await readFile(path.join(DATA_DIR, ...parts), "utf-8");
  return JSON.parse(raw) as T;
}

const tryJson = <T>(...parts: string[]) =>
  readJson<T>(...parts).catch(() => undefined);

export const getEventsIndex = () => readJson<EventsIndex>("events.json");
export const getManifest = (id: string) => readJson<EventManifest>(id, "manifest.json");
export const getMetrics = (id: string) => readJson<EventMetrics>(id, "metrics.json");
export const getSeries = (id: string) =>
  readJson<SeriesDaily>(id, "series", "imerg_smap_daily.json");
export const getAlerts = () => readJson<AlertsFile>("alerts.json");

const geo = (id: string, name: string) =>
  tryJson<GeoJSON.FeatureCollection>(id, "geojson", `${name}.geojson`);

// One case = one directory under public/data (an events.json entry or `now`).
export async function getCaseBundle(
  id: string,
  title: string,
  bbox: [number, number, number, number],
  reference_date: string
): Promise<CaseBundle> {
  const [manifest, metrics, series, zones, water, flood, scars, places] =
    await Promise.all([
      tryJson<EventManifest>(id, "manifest.json"),
      tryJson<EventMetrics>(id, "metrics.json"),
      tryJson<SeriesDaily>(id, "series", "imerg_smap_daily.json"),
      geo(id, "priority_zones"),
      geo(id, "permanent_water"),
      geo(id, "flood_confirmed"),
      geo(id, "landslide_candidates"),
      geo(id, "places"),
    ]);

  return {
    id,
    title,
    mode: manifest?.mode ?? "replay",
    bbox: manifest?.bounds ?? bbox,
    reference_date,
    updated_at: manifest?.updated_at,
    data_dates: manifest?.data_dates,
    manifest,
    metrics,
    series,
    zones,
    water,
    flood,
    scars,
    places,
  };
}
