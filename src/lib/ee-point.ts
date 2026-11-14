// Live Earth Engine point sample: per-pixel TPI/R/S/T values at (lat, lon)
// for the map popup (ruling L10(d) — the GEE point query is primary, COG
// reads are the fallback). Six assets are sampled per request: the four
// daily series (tpi_slide, tpi_flood, r, s at <root>/<canonical>/<id>_series,
// bands YYYY-MM-DD, YYYYMMDD, or dYYYYMMDD = window end date) and the two statics (t_slide, t_flood at the
// bare <id>). A manifest layer entry's `asset` (matched on id+date) always
// wins. Sampling is reduceRegion(Reducer.first()) over a Point geometry,
// all six assets in parallel; a missing asset or band yields null for that
// field, and only when no asset getInfo answers at all is the request a 404.
// Requires service-account creds (see lib/ee); tests inject a fake ee via
// createPointService.
import { credentialEnv, earthEngine } from "./ee";
import { canonicalCaseId, caseAlias } from "./contract";
import { getRootManifest } from "./data";
import {
  CredsError,
  eeAssetRoot,
  errMessage,
  imageInfo,
  TileNotFoundError,
  TileServiceError,
  withTimeout,
} from "./ee-shared";
import type { ImageInfo } from "./ee-shared";
import type { ManifestLayer } from "./types";

export { CredsError, TileNotFoundError, TileServiceError };

export interface PointQuery {
  caseId: string;
  date: string; // normalized YYYY-MM-DD
  lat: number;
  lon: number;
}

export interface PointValues {
  tpi_slide: number | null;
  tpi_flood: number | null;
  r: number | null;
  s: number | null;
  t_slide: number | null;
  t_flood: number | null;
}

export interface PointResult {
  case: string; // echo of the request param
  canonical: string;
  date: string;
  lat: number;
  lon: number;
  data_date: string | null;
  values: PointValues;
}

// --- structural ee typing --------------------------------------------------
// The slice of the ee module the sampler needs — the real module from
// earthEngine() (cast) or a test fake that records the chained calls.

type InfoCallback = (data: unknown, error?: string) => void;

interface EeComputed {
  getInfo(callback: InfoCallback): void;
}

interface EeImageLike extends EeComputed {
  select(band: string): EeImageLike;
  reduceRegion(params: {
    reducer?: unknown;
    geometry?: unknown;
    scale?: number;
    bestEffort?: boolean;
    maxPixels?: number;
  }): EeComputed;
}

export interface EeLike {
  Image(id: string): EeImageLike;
  Geometry: { Point(lon: number, lat: number): unknown };
  Reducer: { first(): unknown };
}

// ---------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

const TTL_MS = 10 * 60 * 1000; // 10 min success cache
const NEG_TTL_MS = 30 * 1000; // 30 s negative cache (404 / timeout)
const DEFAULT_TIMEOUT_MS = 8000; // GEE_TIMEOUT_MS env override
const DEFAULT_SCALE_M = 1000; // GEE_POINT_SCALE_M env override

// Sampled fields in response order. kind "series" resolves to
// <canonical>/<id>_series (date band required unless single-band); "static"
// resolves to the bare <canonical>/<id> single-band asset.
const SPECS = [
  { field: "tpi_slide", kind: "series" },
  { field: "tpi_flood", kind: "series" },
  { field: "r", kind: "series" },
  { field: "s", kind: "series" },
  { field: "t_slide", kind: "static" },
  { field: "t_flood", kind: "static" },
] as const;
type Field = (typeof SPECS)[number]["field"];

interface CacheEntry {
  result?: PointResult;
  error?: Error;
  issuedAt: number;
}
const cache = new Map<string, CacheEntry>();

// Test hook — the cache is module-level per the spec, so suites reset it.
export function clearPointCache(): void {
  cache.clear();
}

function defaultTimeoutMs(): number {
  const t = Number(process.env.GEE_TIMEOUT_MS);
  return Number.isFinite(t) && t > 0 ? t : DEFAULT_TIMEOUT_MS;
}

function defaultScaleM(): number {
  const s = Number(process.env.GEE_POINT_SCALE_M);
  return Number.isFinite(s) && s > 0 ? s : DEFAULT_SCALE_M;
}

// Errors worth negative-caching: nothing answered (404) and EE roundtrip
// timeouts (503) — a missing asset or an EE blip shouldn't cost a fresh
// roundtrip on every popup click.
function isNegativeCacheable(e: Error): boolean {
  return (
    e instanceof TileNotFoundError ||
    (e instanceof TileServiceError && e.message.startsWith("timeout"))
  );
}

function bandIds(info: ImageInfo): string[] {
  const bands = Array.isArray(info.bands) ? info.bands : [];
  return bands
    .map((b) => (isRecord(b) ? str(b.id) : undefined))
    .filter((s): s is string => Boolean(s));
}

// Manifest layer entries may declare an `asset`; the entry matches on both
// layer id and date (dashed or compact) like ee-tiles' manifestAssetFromRoot.
type LayerAsset = ManifestLayer & { asset?: string };

async function defaultManifestAsset(
  canonical: string,
  caseId: string,
  layer: string,
  date: string
): Promise<string | null> {
  const root = await getRootManifest();
  const alias = caseAlias(canonical);
  const kase =
    root?.cases?.[canonical] ??
    root?.cases?.[caseId] ??
    (alias ? root?.cases?.[alias] : undefined);
  const compact = date.replace(/-/g, "");
  const entry = (kase?.layers as LayerAsset[] | undefined)?.find(
    (l) => l.id === layer && (l.date === date || l.date === compact)
  );
  return typeof entry?.asset === "string" && entry.asset.length > 0
    ? entry.asset
    : null;
}

export interface PointServiceOptions {
  assetRoot?: string;
  timeoutMs?: number; // defaults to GEE_TIMEOUT_MS / 8000
  scaleM?: number; // defaults to GEE_POINT_SCALE_M / 1000
  now?: () => number; // ms clock, injectable for cache tests
  ttlMs?: number;
  negTtlMs?: number;
  // Injectable manifest-asset lookup for tests; default reads the root
  // manifest via lib/data.
  manifestAsset?: (
    canonical: string,
    caseId: string,
    layer: string,
    date: string
  ) => Promise<string | null> | string | null;
}

export interface PointService {
  getPoint(query: PointQuery): Promise<PointResult>;
}

interface SampleOutcome {
  field: Field;
  answered: boolean; // asset-level getInfo succeeded (band may still be null)
  value: number | null;
  dataDate: string | null;
}

// Injectable service: pass the real ee module from earthEngine() or a fake
// that records Image/select/reduceRegion/getInfo calls.
export function createPointService(
  ee: EeLike,
  opts: PointServiceOptions = {}
): PointService {
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? TTL_MS;
  const negTtl = opts.negTtlMs ?? NEG_TTL_MS;
  const manifestAsset = opts.manifestAsset ?? defaultManifestAsset;

  async function getPoint({
    caseId,
    date,
    lat,
    lon,
  }: PointQuery): Promise<PointResult> {
    const canonical = canonicalCaseId(caseId);
    // Lat/lon are rounded to 3 decimals (~110 m) before the EE call AND the
    // cache key — the same pixel is never sampled twice.
    const rlat = Math.round(lat * 1000) / 1000;
    const rlon = Math.round(lon * 1000) / 1000;
    const key = `${canonical}|${date}|${rlat.toFixed(3)}|${rlon.toFixed(3)}`;
    const hit = cache.get(key);
    if (hit) {
      const age = now() - hit.issuedAt;
      if (hit.result && age < ttl) return hit.result;
      if (hit.error && age < negTtl) throw hit.error;
      cache.delete(key);
    }

    try {
      const result = await compute(canonical, caseId, date, rlat, rlon);
      cache.set(key, { result, issuedAt: now() });
      return result;
    } catch (e) {
      const err = e as Error;
      if (isNegativeCacheable(err)) {
        cache.set(key, { error: err, issuedAt: now() });
      }
      throw err;
    }
  }

  async function resolveAsset(
    canonical: string,
    caseId: string,
    spec: (typeof SPECS)[number],
    date: string,
    assetRoot: string
  ): Promise<string> {
    const explicit = await manifestAsset(canonical, caseId, spec.field, date);
    if (explicit) return explicit;
    return spec.kind === "series"
      ? `${assetRoot}/${canonical}/${spec.field}_series`
      : `${assetRoot}/${canonical}/${spec.field}`;
  }

  // Sample one asset: getInfo (does it exist / which bands), select the date
  // band (YYYY-MM-DD, YYYYMMDD, or dYYYYMMDD = window end date; single-band assets used as-is), then
  // reduceRegion(first) at the point. TileNotFoundError at either roundtrip
  // degrades to value:null — at the asset level it also marks the asset as
  // unanswered for the all-missing 404 check. Other errors propagate (502 /
  // 503 at the route).
  async function sampleOne(
    spec: (typeof SPECS)[number],
    asset: string,
    date: string,
    lon: number,
    lat: number,
    timeout: number,
    scale: number
  ): Promise<SampleOutcome> {
    const img = ee.Image(asset);
    let info: ImageInfo;
    try {
      info = await withTimeout(
        imageInfo(img, `getInfo on ${asset}`),
        timeout,
        `getInfo on ${asset}`
      );
    } catch (e) {
      if (e instanceof TileNotFoundError) {
        return { field: spec.field, answered: false, value: null, dataDate: null };
      }
      throw e;
    }

    const props = isRecord(info.properties) ? info.properties : {};
    const dataDate = str(props.data_date) ?? str(props.updated_at) ?? null;

    const bands = bandIds(info);
    const compact = date.replace(/-/g, "");
    const band = bands.find((b) => b === date || b === compact || b === `d${compact}`);
    let target: EeImageLike;
    if (band !== undefined) {
      target = img.select(band);
    } else if (bands.length === 1) {
      target = img; // single-band asset (statics, masks) used as-is
    } else {
      // Asset exists but the date band doesn't — answered, value null.
      return { field: spec.field, answered: true, value: null, dataDate };
    }

    let dict: ImageInfo;
    try {
      dict = await withTimeout(
        imageInfo(
          target.reduceRegion({
            reducer: ee.Reducer.first(),
            geometry: ee.Geometry.Point(lon, lat),
            scale,
          }),
          `reduceRegion on ${asset}`
        ),
        timeout,
        `reduceRegion on ${asset}`
      );
    } catch (e) {
      if (e instanceof TileNotFoundError) {
        return { field: spec.field, answered: true, value: null, dataDate };
      }
      throw e;
    }
    const value =
      Object.values(dict as Record<string, unknown>)
        .map(num)
        .find((n) => n !== undefined) ?? null;
    return { field: spec.field, answered: true, value, dataDate };
  }

  async function compute(
    canonical: string,
    caseId: string,
    date: string,
    lat: number,
    lon: number
  ): Promise<PointResult> {
    const timeout = opts.timeoutMs ?? defaultTimeoutMs();
    const scale = opts.scaleM ?? defaultScaleM();
    const assetRoot = opts.assetRoot ?? eeAssetRoot();

    const settled = await Promise.allSettled(
      SPECS.map(async (spec) =>
        sampleOne(
          spec,
          await resolveAsset(canonical, caseId, spec, date, assetRoot),
          date,
          lon,
          lat,
          timeout,
          scale
        )
      )
    );

    // Any non-not-found failure (compute error, timeout) fails the request —
    // missing assets were already degraded to nulls inside sampleOne.
    const failure = settled.find((r) => r.status === "rejected");
    if (failure) throw (failure as PromiseRejectedResult).reason;

    const outcomes = settled.map(
      (r) => (r as PromiseFulfilledResult<SampleOutcome>).value
    );
    if (!outcomes.some((o) => o.answered)) {
      throw new TileNotFoundError(
        `no point asset answered for case ${canonical}`
      );
    }

    const values = {} as PointValues;
    for (const o of outcomes) values[o.field] = o.value;
    const dataDate = outcomes.find((o) => o.answered)?.dataDate ?? null;

    return {
      case: caseId,
      canonical,
      date,
      lat,
      lon,
      data_date: dataDate,
      values,
    };
  }

  return { getPoint };
}

// Test hook — lets route tests drive 404/200 paths without real creds.
let serviceForTest: PointService | undefined;
export function setPointServiceForTest(svc: PointService | undefined): void {
  serviceForTest = svc;
}

// Credentialed entry point used by the route. Checks the env chain first so a
// missing key is a CredsError (503), not an init failure.
export async function getPoint(query: PointQuery): Promise<PointResult> {
  if (!credentialEnv()) {
    throw new CredsError(
      "no service-account key (set GCP_SA_KEY or GEE_SERVICE_ACCOUNT_KEY)"
    );
  }
  if (serviceForTest) return serviceForTest.getPoint(query);
  let eeClient: EeLike;
  try {
    eeClient = (await earthEngine()) as unknown as EeLike;
  } catch (e) {
    throw new TileServiceError(`gee init failed: ${errMessage(e)}`);
  }
  return createPointService(eeClient).getPoint(query);
}
