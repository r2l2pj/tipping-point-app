// Replay city finder (L52, Lucas): the search box works inside a replay
// case too — its source is the case's own municipalities
// (products.municipal_boundaries polygons: name, code, uf, pop,
// teammate_candidates_km2) plus the towns of products.places (points,
// kind 'town'). A replay without either file falls back to the live
// places.json filtered to the case bbox; with no source at all the box
// hides. Selecting a replay city stays in the replay (never switches to
// Now) and shows no live forecast numbers.
import { geoUrl } from "@/lib/layers";
import { caseDirOf, declared } from "./lazy";
import { fold, type Bbox, type Place, type Places } from "./places";
import type { CcBundle } from "./types";

type M = Record<string, unknown>;
const isRecord = (v: unknown): v is M => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// What the search box reads. "live" = the Now places.json as-is; "geo" =
// the replay case's own files; "live-box" = the Now list filtered to the
// case bounds (a replay without its own files, e.g. RS 2024).
export type SearchSource =
  | { kind: "live"; url: string }
  | { kind: "live-box"; url: string; bbox: Bbox }
  | { kind: "geo"; muni?: string; towns?: string };

// A replay municipality/town shaped like a Place (empty hazard days — the
// card carries no forecast) plus the polygon outline, the teammate flood
// area and the IBGE code (the places_daily key).
export interface ReplayPlace extends Place {
  outline: GeoJSON.Feature | null;
  teammateKm2: number | null;
  code: string | null;
}

// The source for a replay case's search box; undefined = hide it.
export function replaySource(
  bundle: CcBundle,
  livePlacesUrl?: string
): SearchSource | undefined {
  const dir = caseDirOf(bundle);
  const muni = declared(bundle, "municipal_boundaries")
    ? geoUrl(bundle, dir, "municipal_boundaries", "geojson/municipal_boundaries.geojson")
    : undefined;
  const towns = declared(bundle, "places")
    ? geoUrl(bundle, dir, "places", "geojson/places.geojson")
    : undefined;
  if (muni || towns) return { kind: "geo", muni, towns };
  if (livePlacesUrl) return { kind: "live-box", url: livePlacesUrl, bbox: bundle.bbox };
  return undefined;
}

const walk = (v: unknown, out: [number, number][]): void => {
  if (!Array.isArray(v)) return;
  if (v.length >= 2 && typeof v[0] === "number" && typeof v[1] === "number") out.push([v[0], v[1]]);
  else for (const x of v) walk(x, out);
};

const geomBbox = (g: GeoJSON.Geometry | null | undefined): Bbox | undefined => {
  const pts: [number, number][] = [];
  walk((g as { coordinates?: unknown } | null | undefined)?.coordinates, pts);
  if (!pts.length) return undefined;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of pts) {
    w = Math.min(w, x); s = Math.min(s, y);
    e = Math.max(e, x); n = Math.max(n, y);
  }
  return [w, s, e, n];
};

const base = (p: {
  id: string; name: string; uf: string; centroid: [number, number]; bbox: Bbox;
  pop: number | null; outline: GeoJSON.Feature | null;
  teammateKm2: number | null; code: string | null;
}): ReplayPlace => ({
  flood: { cls: [], max: [] },
  slide: { cls: [], max: [] },
  pTrigger: {},
  alert: false, alertLevel: null, alertHazard: null, peopleHigh: null,
  key: fold(`${p.name} ${p.uf}`),
  ...p,
});

const featureToReplayPlace = (f: GeoJSON.Feature): ReplayPlace | null => {
  const p = (f.properties ?? {}) as M;
  const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : null;
  const bbox = geomBbox(f.geometry);
  if (!name || !bbox) return null;
  const uf = typeof p.uf === "string" ? p.uf : "";
  const code = p.code != null ? String(p.code) : null;
  return base({
    id: code ?? `muni-${name}-${uf}`,
    name, uf,
    centroid: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
    bbox,
    pop: num(p.pop),
    outline: f,
    teammateKm2: num(p.teammate_candidates_km2),
    code,
  });
};

const pointToReplayPlace = (f: GeoJSON.Feature): ReplayPlace | null => {
  const g = f.geometry;
  const c =
    g?.type === "Point" && Array.isArray(g.coordinates) && g.coordinates.length >= 2
      ? (g.coordinates as [number, number])
      : undefined;
  const p = (f.properties ?? {}) as M;
  const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : null;
  if (!name || !c) return null;
  const uf = typeof p.uf === "string" ? p.uf : "";
  const pad = 0.04;
  return base({
    id: `town-${name}-${uf}`,
    name, uf,
    centroid: c,
    bbox: [c[0] - pad, c[1] - pad, c[0] + pad, c[1] + pad],
    pop: num(p.pop),
    outline: null,
    teammateKm2: null,
    code: p.code != null ? String(p.code) : null,
  });
};

// Municipal polygons first; town points join when not already covered
// (deduped on the normalized "name uf" key).
export function replayPlacesFrom(
  muni: GeoJSON.FeatureCollection | null | undefined,
  towns: GeoJSON.FeatureCollection | null | undefined
): Places {
  const places: ReplayPlace[] = [];
  const seen = new Set<string>(); // name alone: town points carry no uf
  for (const f of muni?.features ?? []) {
    const p = featureToReplayPlace(f);
    if (p && !seen.has(fold(p.name))) { places.push(p); seen.add(fold(p.name)); }
  }
  for (const f of towns?.features ?? []) {
    const p = pointToReplayPlace(f);
    if (p && !seen.has(fold(p.name))) { places.push(p); seen.add(fold(p.name)); }
  }
  return { dates: [], places };
}

// The live places list cut to a case's bounds (centroid inside).
export function filterPlacesToBBox(all: Places, bbox: Bbox): Places {
  return {
    ...all,
    places: all.places.filter(
      (p) =>
        p.centroid[0] >= bbox[0] && p.centroid[0] <= bbox[2] &&
        p.centroid[1] >= bbox[1] && p.centroid[1] <= bbox[3]
    ),
  };
}

// lead-analysis places-daily (schema tipping-point/places-daily@1): the
// observed flood class per municipality per day.
export function placesDailyUrl(bundle: CcBundle): string | undefined {
  return declared(bundle, "places_daily")
    ? geoUrl(bundle, caseDirOf(bundle), "places_daily", "places_daily.json")
    : undefined;
}

// places[<IBGE code>].observed[YYYY-MM-DD].flood_class_max (0-3).
export function replayDayClass(
  daily: unknown,
  code: string | null | undefined,
  date: string | undefined
): number | null {
  if (!isRecord(daily) || !code || !date) return null;
  const entry = isRecord(daily.places) && isRecord(daily.places[code]) ? daily.places[code] : undefined;
  const day = entry && isRecord(entry.observed) && isRecord(entry.observed[date]) ? entry.observed[date] : undefined;
  return day ? num(day.flood_class_max) : null;
}
