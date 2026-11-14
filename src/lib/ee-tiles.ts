// Live Earth Engine map tiles: one asset per (case, layer) under
// `${GEE_ASSET_ROOT}/<canonical_case>/<layer>` — multiband daily series
// (`<layer>_series`, one band per day, band = YYYY-MM-DD or YYYYMMDD) or
// single-band images (`now/<layer>_dN`, masks). A manifest layer entry may
// pin an explicit `asset`, which always wins — it is the only way `now`
// resolves (its date→_dN mapping lives in the manifest). Styled server-side
// per LAYER_VIS and returned as a getMapId tile-URL template cached ~2 h.
// Requires service-account creds (see lib/ee); tests inject a fake ee via
// createTileService.
import { credentialEnv, earthEngine } from "./ee";
import { canonicalCaseId } from "./contract";
import { getRootManifest } from "./data";
import { TPI_CLASSES } from "./tpi";
import {
  CredsError,
  errMessage,
  imageInfo,
  mapComputeError,
  TileNotFoundError,
  TileServiceError,
  withTimeout,
} from "./ee-shared";

export { CredsError, TileNotFoundError, TileServiceError };

// Per-layer server-side styling. kinds: "classes" bins TPI 0..1 at the class
// mins; "ramp" masks below min and paints min→max; "mask" selfMasks a binary
// raster into a single color; "categorical" masks 0 and paints min→max.
type VisSpec =
  | { kind: "classes" }
  | { kind: "ramp"; min: number; max: number; palette: string[] }
  | { kind: "mask"; color: string }
  | { kind: "categorical"; min: number; max: number; palette: string[] };

export const LAYER_VIS = {
  tpi_slide: { kind: "classes" },
  tpi_flood: { kind: "classes" },
  t_ml: { kind: "classes" },
  nisar_pre: { kind: "ramp", min: -25, max: -5, palette: ["#000000", "#FFFFFF"] },
  nisar_post: { kind: "ramp", min: -25, max: -5, palette: ["#000000", "#FFFFFF"] },
  night_lights_pre: {
    kind: "ramp",
    min: 0,
    max: 10,
    palette: ["#440154", "#31688E", "#35B779", "#FDE725"],
  },
  night_lights_post: {
    kind: "ramp",
    min: 0,
    max: 10,
    palette: ["#440154", "#31688E", "#35B779", "#FDE725"],
  },
  hillshade: { kind: "ramp", min: 0, max: 255, palette: ["#000000", "#FFFFFF"] },
  imerg: { kind: "ramp", min: 0, max: 50, palette: ["#F7FBFF", "#2166AC"] },
  smap: {
    kind: "ramp",
    min: 0,
    max: 1,
    palette: ["#8C510A", "#F6E8C3", "#2166AC"],
  },
  flood_confirmed: { kind: "mask", color: "#2166AC" },
  permanent_water: { kind: "mask", color: "#9ECAE1" },
  landslide_candidates: { kind: "mask", color: "#7B3294" },
  opera_validation: {
    kind: "categorical",
    min: 1,
    max: 4,
    // 1 both, 2 NISAR-only, 3 OPERA-only, 4 cloud
    palette: ["#2166AC", "#92C5DE", "#F4A582", "#BDBDBD"],
  },
} satisfies Record<string, VisSpec>;

export type TileLayer = keyof typeof LAYER_VIS;
export const TILE_LAYERS = Object.keys(LAYER_VIS) as TileLayer[];

export interface TileQuery {
  layer: TileLayer;
  caseId: string;
  date: string; // band name on the *_series asset: YYYY-MM-DD or YYYYMMDD
}

export interface TileResult {
  tiles: string[]; // urlFormat template(s), {z}/{x}/{y} placeholders intact
  expires_at: string; // ISO — cache lifetime, not the EE mapid lease
  data_date: string | null; // asset properties data_date ?? updated_at
  layer: TileLayer;
  case: string;
  date: string;
}

// The ee module shape the service needs — the real module from earthEngine()
// or a test fake (cast to this type).
export type EeClient = Awaited<ReturnType<typeof earthEngine>>;
type EeImage = ReturnType<EeClient["Image"]>;
type EeMapId = { urlFormat?: string; url_format?: string };

const TTL_MS = 2 * 60 * 60 * 1000; // 2 h
const REFRESH_SKEW_MS = 5 * 60 * 1000; // refetch slightly early, never serve stale
const DEFAULT_TIMEOUT_MS = 8000; // GEE_TIMEOUT_MS env override
// Class cuts and palette come from TPI_CLASSES: classes 1..3 (moderate,
// high, critical) get painted; class 0 (Low) is masked transparent.
const CUTS = TPI_CLASSES.slice(1).map((c) => c.min);
const PALETTE = TPI_CLASSES.slice(1).map((c) => c.color);

interface CacheEntry {
  tiles: string[];
  dataDate: string | null;
  issuedAt: number;
}
const cache = new Map<string, CacheEntry>();

// Test hook — the cache is module-level per the spec, so suites reset it.
export function clearTileCache(): void {
  cache.clear();
}

function defaultAssetRoot(): string {
  return (
    process.env.GEE_ASSET_ROOT ??
    (process.env.GEE_PROJECT
      ? `projects/${process.env.GEE_PROJECT}/assets/tipping-point`
      : "tipping-point")
  );
}

// v4 SCHEMA-pinned extension: a manifest layer entry may carry `asset`
// (explicit GEE asset id). Absent on older syncs → convention fallback.
async function manifestAssetFromRoot(
  caseId: string,
  layer: string,
  date: string
): Promise<string | null> {
  const root = await getRootManifest();
  const kase = root?.cases?.[canonicalCaseId(caseId)] ?? root?.cases?.[caseId];
  const entry = kase?.layers?.find((l) => l.id === layer && l.date === date);
  const asset = (entry as { asset?: unknown } | undefined)?.asset;
  return typeof asset === "string" && asset.length > 0 ? asset : null;
}

function getMapId(img: EeImage, asset: string): Promise<EeMapId> {
  return new Promise((resolve, reject) => {
    try {
      img.getMapId((id, err) => {
        if (err || !id)
          return reject(
            mapComputeError(err ?? "empty map id", `getMapId on ${asset}`)
          );
        resolve(id);
      });
    } catch (e) {
      reject(mapComputeError(e, `getMapId on ${asset}`));
    }
  });
}

// Style the selected single-band image per the registry entry.
function visualizeLayer(img: EeImage, spec: VisSpec): EeImage {
  switch (spec.kind) {
    case "classes": {
      // Bin TPI 0..1 into the 4 doc classes at the class mins → integer
      // raster 0–3; gte matches tpiClass (v >= c.min) so boundary pixels land
      // in the upper class; mask class 0 (Low is transparent); paint the rest.
      let cls = img.gte(CUTS[0]);
      for (const cut of CUTS.slice(1)) cls = cls.add(img.gte(cut));
      return cls
        .updateMask(cls.gt(0))
        .visualize({ min: 1, max: 3, palette: PALETTE });
    }
    case "ramp":
      return img
        .updateMask(img.gte(spec.min))
        .visualize({ min: spec.min, max: spec.max, palette: spec.palette });
    case "mask":
      return img.selfMask().visualize({ palette: [spec.color] });
    case "categorical":
      return img
        .updateMask(img.gt(0))
        .visualize({ min: spec.min, max: spec.max, palette: spec.palette });
  }
}

export interface TileServiceOptions {
  assetRoot?: string; // defaults to GEE_ASSET_ROOT / projects/$GEE_PROJECT/assets/tipping-point
  now?: () => number; // ms clock, injectable for cache tests
  ttlMs?: number;
  refreshSkewMs?: number;
  timeoutMs?: number; // defaults to GEE_TIMEOUT_MS env or 8000
  // Manifest-provided explicit GEE asset for (caseId, layer, date); null →
  // the <root>/<canonical>/<layer>_series convention (or 404 for `now`).
  manifestAsset?: (
    caseId: string,
    layer: string,
    date: string
  ) => Promise<string | null>;
}

export interface TileService {
  getTiles(query: TileQuery): Promise<TileResult>;
}

// Injectable service: pass the real ee module from earthEngine() or a fake
// that records Image/select/visualize/getMapId calls.
export function createTileService(
  eeClient: EeClient,
  opts: TileServiceOptions = {}
): TileService {
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? TTL_MS;
  const skew = opts.refreshSkewMs ?? REFRESH_SKEW_MS;
  const envTimeout = Number(process.env.GEE_TIMEOUT_MS);
  const timeoutMs =
    opts.timeoutMs ?? (envTimeout > 0 ? envTimeout : DEFAULT_TIMEOUT_MS);
  const assetRoot = opts.assetRoot ?? defaultAssetRoot();
  const manifestAsset = opts.manifestAsset ?? manifestAssetFromRoot;

  // Manifest `asset` first; else the `<root>/<canonical>/<layer>_series`
  // convention. `now` has no convention (the date→_dN mapping lives in the
  // manifest), so a missing manifest asset is a 404.
  async function resolveAsset(
    layer: string,
    canonical: string,
    caseId: string,
    date: string
  ): Promise<string> {
    const explicit = await manifestAsset(caseId, layer, date);
    if (explicit) return explicit;
    if (canonical === "now")
      throw new TileNotFoundError(
        `no manifest asset for case now layer ${layer} date ${date}`
      );
    return `${assetRoot}/${canonical}/${layer}_series`;
  }

  async function getTiles({
    layer,
    caseId,
    date,
  }: TileQuery): Promise<TileResult> {
    const canonical = canonicalCaseId(caseId);
    const key = `${layer}|${canonical}|${date}`;
    const hit = cache.get(key);
    if (hit && now() - hit.issuedAt < ttl - skew) {
      return {
        tiles: hit.tiles,
        expires_at: new Date(hit.issuedAt + ttl).toISOString(),
        data_date: hit.dataDate,
        layer,
        case: caseId,
        date,
      };
    }

    const asset = await resolveAsset(layer, canonical, caseId, date);
    const img = eeClient.Image(asset);
    const info = await withTimeout(
      imageInfo(img, `getInfo on ${asset}`),
      timeoutMs,
      `getInfo on ${asset}`
    );

    // One getInfo per call, before selecting: the date band must exist
    // (dashed or compact form) — except single-band daily assets, which are
    // used as-is.
    const bands = (info.bands ?? [])
      .map((b) => b?.id)
      .filter((b): b is string => typeof b === "string");
    const compact = date.replace(/-/g, "");
    const band = bands.find((b) => b === date || b === compact);
    let selected: EeImage;
    if (band !== undefined) {
      selected = img.select(band);
    } else if (bands.length === 1) {
      selected = img; // single-day asset (e.g. now/<layer>_d1) or a mask
    } else {
      throw new TileNotFoundError(`no band ${date} on ${asset}`);
    }

    const vis = visualizeLayer(selected, LAYER_VIS[layer]);
    const map = await withTimeout(
      getMapId(vis, asset),
      timeoutMs,
      `getMapId on ${asset}`
    );
    const url = map.urlFormat ?? map.url_format;
    if (!url) {
      throw new TileServiceError(`getMapId on ${asset} returned no tile url`);
    }

    const props = info.properties ?? {};
    const dataDate =
      typeof props.data_date === "string"
        ? props.data_date
        : typeof props.updated_at === "string"
          ? props.updated_at
          : null;

    const issuedAt = now();
    cache.set(key, { tiles: [url], dataDate, issuedAt });
    return {
      tiles: [url],
      expires_at: new Date(issuedAt + ttl).toISOString(),
      data_date: dataDate,
      layer,
      case: caseId,
      date,
    };
  }

  return { getTiles };
}

// Credentialed entry point used by the route. Checks the env chain first so a
// missing key is a CredsError (503), not an init failure.
export async function getTiles(query: TileQuery): Promise<TileResult> {
  if (!credentialEnv()) {
    throw new CredsError(
      "no service-account key (set GCP_SA_KEY or GEE_SERVICE_ACCOUNT_KEY)"
    );
  }
  let eeClient: EeClient;
  try {
    eeClient = await earthEngine();
  } catch (e) {
    throw new TileServiceError(`gee init failed: ${errMessage(e)}`);
  }
  return createTileService(eeClient).getTiles(query);
}
