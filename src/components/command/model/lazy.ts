// The trimmed-bundle contract of the loader (src/lib/data.ts): heavy GeoJSON
// products do not ride in the bundle. The browser fetches each one by URL
// (fetchGeo / geoUrl in src/lib/layers.ts, one shared cache with the map),
// and priority zones arrive inline only as the top 20 by rank, as points.
// This module holds the pure part: what is declared, what the pending list
// overrides, and how fetched files are merged into the bundle the model reads.
import { canonicalCaseId } from "@/lib/contract";
import { geoUrl } from "@/lib/layers";
import type { CcBundle } from "./types";

const FIXED: Record<string, string> = {
  priority_zones: "geojson/priority_zones.geojson",
  permanent_water: "geojson/permanent_water.geojson",
  flood_confirmed: "geojson/flood_confirmed.geojson",
  landslide_candidates: "geojson/landslide_candidates.geojson",
  landslide_catalog: "geojson/landslide_catalog.geojson",
  municipal_boundaries: "geojson/municipal_boundaries.geojson",
};

export const caseDirOf = (bundle: CcBundle): string =>
  canonicalCaseId(bundle.manifest?.event ?? bundle.id);

const products = (bundle: CcBundle): Record<string, unknown> | undefined =>
  (bundle.products ?? bundle.manifest?.products) as Record<string, unknown> | undefined;

// The products map names a file for the key. Null (declared absent) and a
// missing key are both "not declared": nothing is fetched for them.
export const declared = (bundle: CcBundle, key: string): boolean =>
  typeof products(bundle)?.[key] === "string";

// URL of a declared GeoJSON product, else undefined.
export const productUrl = (bundle: CcBundle, key: string): string | undefined =>
  declared(bundle, key) && FIXED[key]
    ? geoUrl(bundle, caseDirOf(bundle), key, FIXED[key])
    : undefined;

// The inline zones are the trimmed copy when they are points.
export const zonesAreTrimmed = (bundle: CcBundle): boolean =>
  Boolean(bundle.zones?.features.length) &&
  bundle.zones!.features.every((f) => f.geometry?.type === "Point");

const PENDING_FIELD: Record<string, keyof CcBundle> = {
  metrics: "metricsView",
  series: "series",
  summary: "summary",
  alerts: "nowAlerts",
  priority_zones: "zones",
  landslide_candidates: "scars",
};

// A pending token wins over a value: an output the loader lists as pending
// is treated as absent everywhere (same rule as pendingIncludes on main).
export function effectiveBundle(bundle: CcBundle): CcBundle {
  const tokens = Array.isArray(bundle.pending) ? bundle.pending : [];
  let out = bundle;
  for (const token of tokens) {
    const field = PENDING_FIELD[token];
    if (field && out[field] !== undefined) out = { ...out, [field]: undefined };
  }
  return out;
}

type Fetched = GeoJSON.FeatureCollection | null | undefined; // undefined: loading

// Merge files fetched in the browser. `undefined` means still loading, `null`
// means the fetch found no file.
export function withLazy(
  bundle: CcBundle,
  fetched: { zones?: Fetched; scars?: Fetched; zonesRequested?: boolean; scarsRequested?: boolean }
): CcBundle {
  const lazy: NonNullable<CcBundle["lazy"]> = {};
  let out = bundle;
  if (fetched.zonesRequested) {
    if (fetched.zones) out = { ...out, zones: fetched.zones };
    else {
      lazy.priority_zones = fetched.zones === null ? "missing" : "loading";
      out = { ...out, zonesTrimmed: zonesAreTrimmed(bundle) };
    }
  }
  if (fetched.scarsRequested) {
    if (fetched.scars) out = { ...out, scars: fetched.scars };
    else lazy.landslide_candidates = fetched.scars === null ? "missing" : "loading";
  }
  return Object.keys(lazy).length ? { ...out, lazy } : out;
}

export const LOADING_TEXT = "loading";
