// Live response outputs of the Now case (lead-live R2): flood polygons found
// by comparing two NISAR GCOV radar passes. Contract (agreed with lead-live,
// 2026-11-15): the now node's products map declares
//   flood_nisar: "response/flood_nisar.geojson"
//   nisar_meta:  "response/nisar_meta.json"
// and drops a key whose file is absent. A later optical source (R1) adds
// flood_dswx + dswx_meta the same way. Polygons are radar flood candidates,
// never "confirmed".
import type { NowResponse } from "./types";

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
    geojson: str(raw.geojson),
    null_reasons: reasons && Object.keys(reasons).length ? reasons : undefined,
  };
  const hasContent =
    out.flooded_km2 !== undefined || out.post_acquired !== undefined || out.null_reasons;
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
