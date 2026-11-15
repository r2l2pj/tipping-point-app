// Live response outputs of the Now case (lead-live R2): flood polygons found
// by comparing two NISAR GCOV radar passes. Contract (agreed with lead-live,
// 2026-11-15): the now node's products map declares
//   flood_nisar: "response/flood_nisar.geojson"
//   nisar_meta:  "response/nisar_meta.json"
// and drops a key whose file is absent. A later optical source (R1) adds
// flood_dswx + dswx_meta the same way. Polygons are radar flood candidates,
// never "confirmed".
import type { NowDist, NowResponse, ResponseSource } from "./types";

export const NISAR_META = "response/nisar_meta.json";
export const NISAR_GEOJSON = "response/flood_nisar.geojson";

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v ? v : undefined;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Normalizes nisar_meta.json. Returns undefined when the file is not a
// response summary (nothing to show). Pair dates come from the newest pair.
export function toNowResponse(raw: unknown): NowResponse | undefined {
  if (!isRecord(raw)) return undefined;
  const pairs = Array.isArray(raw.pairs) ? raw.pairs.filter(isRecord) : [];
  const newest = [...pairs].sort((a, b) =>
    String(b.post_acquired ?? "").localeCompare(String(a.post_acquired ?? ""))
  )[0];
  const reasons = isRecord(raw._null_reasons)
    ? (Object.fromEntries(
        Object.entries(raw._null_reasons).filter(([, v]) => typeof v === "string")
      ) as Record<string, string>)
    : undefined;
  const out: NowResponse = {
    source: str(raw.source) ?? "nisar-gcov",
    flooded_km2: num(raw.flooded_km2),
    new_km2: num(raw.new_km2),
    receded_km2: num(raw.receded_km2),
    people_flooded: num(raw.people_flooded),
    pre_acquired: str(newest?.pre_acquired),
    post_acquired: str(newest?.post_acquired),
    latest_acquired: str(raw.latest_acquired),
    latency_h: num(raw.latency_h),
    polygons: num(raw.n_polygons),
    status: str(raw.status),
    status_label: str(raw.status_label),
    geojson: str(raw.geojson),
    null_reasons: reasons && Object.keys(reasons).length ? reasons : undefined,
  };
  const hasContent =
    out.flooded_km2 !== undefined || out.post_acquired !== undefined || out.null_reasons || out.status;
  return hasContent ? out : undefined;
}

// Path of the polygon file: the declared product, else the meta's `geojson`
// next to the meta file.
export function responseGeojsonPath(
  products: Record<string, unknown> | undefined,
  response: NowResponse
): string | undefined {
  const declared = products?.flood_nisar;
  if (typeof declared === "string") return declared;
  if (!response.geojson) return undefined;
  const meta = typeof products?.nisar_meta === "string" ? products.nisar_meta : NISAR_META;
  const dir = meta.includes("/") ? meta.slice(0, meta.lastIndexOf("/") + 1) : "";
  return `${dir}${response.geojson}`;
}

// R3 (lead-analysis): now/response/summary.json, schema
// tipping-point/response@1. Per flood source (OPERA DSWx-S1, NISAR GCOV):
// unioned area, people, newest pass. The TPI entry is not an observation.
export const RESPONSE_SUMMARY = "response/summary.json";

export function toResponseSources(raw: unknown): ResponseSource[] | undefined {
  if (!isRecord(raw) || !isRecord(raw.sources)) return undefined;
  const out: ResponseSource[] = [];
  for (const [source, v] of Object.entries(raw.sources)) {
    if (!isRecord(v) || /tpi/i.test(source)) continue;
    const km2 = num(v.flooded_km2);
    if (km2 === undefined || km2 <= 0) continue;
    out.push({
      source,
      flooded_km2: km2,
      people_flooded: num(v.people_flooded),
      latest_acquired: str(v.latest_acquired),
      features: num(v.features),
    });
  }
  return out.length ? out : undefined;
}

// Municipality names per flood source, largest flooded area first, from the
// full R3 priority zones (IBGE municipalities with `sources`,
// `flooded_km2`). Computed on the server: the browser only gets the trimmed
// zone list.
export function placesBySource(
  zones: GeoJSON.FeatureCollection | undefined
): Record<string, string[]> | undefined {
  const by: Record<string, { name: string; km2: number }[]> = {};
  for (const f of zones?.features ?? []) {
    const p = f.properties ?? {};
    const km2 = num(p.flooded_km2);
    const name = str(p.name);
    if (!name || km2 === undefined || km2 <= 0 || !Array.isArray(p.sources)) continue;
    const label = str(p.uf) ? `${name}, ${p.uf}` : name;
    for (const s of p.sources) {
      if (typeof s !== "string" || /tpi/i.test(s)) continue;
      (by[s] ??= []).push({ name: label, km2 });
    }
  }
  const out = Object.fromEntries(
    Object.entries(by).map(([s, list]) => [s, list.sort((a, b) => b.km2 - a.km2).map((x) => x.name)])
  );
  return Object.keys(out).length ? out : undefined;
}

// Landslide scar candidates of the Now case (lead-analysis): OPERA
// DIST-ALERT-HLS vegetation loss on steep slopes, now/response/
// landslide_dist.geojson + dist_meta.json. Candidates, never confirmed; the
// product lags 1-2 weeks and outside a rain event is mostly harvest/fire.
export const DIST_META = "response/dist_meta.json";
export const DIST_GEOJSON = "response/landslide_dist.geojson";

export function toNowDist(raw: unknown): NowDist | undefined {
  if (!isRecord(raw)) return undefined;
  const features = num(raw.features);
  if (features === undefined) return undefined;
  return {
    features,
    km2: num(raw.candidates_km2),
    people: num(raw.people),
    latest_acquired: str(raw.latest_acquired),
    caveat: str(raw.caveat),
    latency_note: str(raw.latency_note),
  };
}
