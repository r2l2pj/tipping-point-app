// Live Earth Engine numbers: km² of critical TPI, people exposed, and
// (optionally) confirmed-flood km²/people for a case+date. Fast path reads
// values the job wrote as asset properties; otherwise it computes them
// server-side via reduceRegion over the date's TPI band. Requires
// service-account creds (see lib/ee); tests inject a fake ee via
// createNumbersService.
import { credentialEnv, earthEngine } from "./ee";
import { canonicalCaseId, caseAlias } from "./contract";
import { getRootManifest } from "./data";
import { TPI_THRESHOLD } from "./tpi";
import type { ManifestLayer } from "./types";

export interface NumbersQuery {
  caseId: string;
  date: string; // YYYY-MM-DD — band on the TPI asset is YYYYMMDD
}

export interface NumbersResult {
  case: string;
  date: string;
  km2_critical?: number;
  people_exposed?: number;
  flooded_km2?: number;
  people_flooded?: number;
  data_date?: string;
  source: "properties" | "computed";
}

export class CredsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredsError";
  }
}

// Missing asset / band / date — the route maps this to 404.
export class NumbersNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NumbersNotFoundError";
  }
}

// An EE roundtrip exceeded GEE_NUMBERS_TIMEOUT_MS — the route maps to 503.
export class NumbersTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NumbersTimeoutError";
  }
}

// Wrapped ee init/compute failure — the route maps this to 502.
export class NumbersServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NumbersServiceError";
  }
}

// --- structural ee typing --------------------------------------------------
// The ee module shape the service needs — the real module from earthEngine()
// (cast, since earthengine.d.ts only declares what ee-tiles uses) or a test
// fake that records the chained calls.

type InfoCallback = (data: unknown, error?: string) => void;

interface EeComputed {
  getInfo(callback: InfoCallback): void;
}

interface EeImageLike {
  select(band: string): EeImageLike;
  gte(value: number): EeImageLike;
  neq(value: number): EeImageLike;
  updateMask(mask: EeImageLike): EeImageLike;
  reduceRegion(params: {
    reducer?: unknown;
    scale?: number;
    bestEffort?: boolean;
    maxPixels?: number;
  }): EeComputed;
  getInfo(callback: InfoCallback): void;
}

interface EeImageCtor {
  (id: string): EeImageLike;
  pixelArea(): EeImageLike;
}

interface EeCollectionLike {
  sort(property: string, ascending?: boolean): EeCollectionLike;
  first(): EeImageLike;
}

export interface EeLike {
  Image: EeImageCtor;
  ImageCollection(id: string): EeCollectionLike;
  Reducer: { sum(): unknown };
}

// ---------------------------------------------------------------------------

const TTL_MS = 10 * 60 * 1000; // 10 min
const NEG_TTL_MS = 30 * 1000; // 30 s
const DEFAULT_TIMEOUT_MS = 15_000;
const GPW_COLLECTION = "CIESIN/GPWv411/GPW_Population_Count";

const NUM_KEYS = [
  "km2_critical",
  "people_exposed",
  "flooded_km2",
  "people_flooded",
] as const;
type NumKey = (typeof NUM_KEYS)[number];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;
const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface CacheEntry {
  result?: NumbersResult;
  error?: Error;
  issuedAt: number;
}
const cache = new Map<string, CacheEntry>();

// Test hook — the cache is module-level per the spec, so suites reset it.
export function clearNumbersCache(): void {
  cache.clear();
}

function defaultAssetRoot(): string {
  // reconcile with ee-tiles resolveAsset after merge — sibling worktree
  // resolves `${root}/${canonical}_<layer>_series` under assets/tpi.
  return (
    process.env.GEE_ASSET_ROOT ??
    (process.env.GEE_PROJECT
      ? `projects/${process.env.GEE_PROJECT}/assets/tipping-point`
      : "tipping-point")
  );
}

function defaultTimeoutMs(): number {
  const t = Number(process.env.GEE_NUMBERS_TIMEOUT_MS);
  return Number.isFinite(t) && t > 0 ? t : DEFAULT_TIMEOUT_MS;
}

// EE "object doesn't exist" style failures read as 404s; anything else is a
// compute/transport failure (502 at the route).
const NOT_FOUND_RE =
  /not found|does not exist|no such|unknown asset|failed to find/i;
function mapComputeError(err: unknown, context: string): Error {
  const msg = `${context}: ${errMessage(err)}`;
  return NOT_FOUND_RE.test(msg)
    ? new NumbersNotFoundError(msg)
    : new NumbersServiceError(msg);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new NumbersTimeoutError(`${label} timed out after ${ms}ms`)),
      ms
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

// Promisified getInfo — every EE roundtrip (asset getInfo, reduceRegion
// evaluation) goes through here so the timeout wraps them all.
function getInfo(
  obj: EeComputed,
  label: string,
  timeoutMs: number
): Promise<Record<string, unknown>> {
  return withTimeout(
    new Promise((resolve, reject) => {
      try {
        obj.getInfo((data, err) => {
          if (err) return reject(mapComputeError(err, label));
          resolve(isRecord(data) ? data : {});
        });
      } catch (e) {
        reject(mapComputeError(e, label));
      }
    }),
    timeoutMs,
    label
  );
}

// Sum one masked image over its footprint; returns the first numeric band in
// the reduce dict (masked-empty regions come back null → 0).
async function reduceSum(
  ee: EeLike,
  img: EeImageLike,
  label: string,
  timeoutMs: number
): Promise<number> {
  const dict = await getInfo(
    img.reduceRegion({
      reducer: ee.Reducer.sum(),
      scale: 1000,
      bestEffort: true,
      maxPixels: 1e9,
    }),
    label,
    timeoutMs
  );
  for (const v of Object.values(dict)) {
    const n = num(v);
    if (n !== undefined) return n;
  }
  return 0;
}

// getInfo payload carries bands[{id}] plus a `properties` dict; some EE
// responses merge properties at the top level — read properties first, fall
// back to the info object itself.
function propsOf(info: Record<string, unknown>): Record<string, unknown> {
  return isRecord(info.properties) ? info.properties : info;
}

function bandIds(info: Record<string, unknown>): string[] {
  const bands = Array.isArray(info.bands) ? info.bands : [];
  return bands
    .map((b) => (isRecord(b) ? str(b.id) : typeof b === "string" ? b : undefined))
    .filter((s): s is string => Boolean(s));
}

// Band name is YYYYMMDD per the data pipeline; accept the dashed form too.
function matchBand(
  info: Record<string, unknown>,
  date: string,
  asset: string
): string {
  const compact = date.replace(/-/g, "");
  const ids = bandIds(info);
  if (ids.includes(compact)) return compact;
  if (ids.includes(date)) return date;
  throw new NumbersNotFoundError(`no band ${compact} on ${asset}`);
}

// Numbers the job may have written as asset properties — either a `numbers`
// dict or flat keys. Returns undefined when neither is present.
function numbersFromProps(
  props: Record<string, unknown>
): Partial<Record<NumKey, number>> | undefined {
  const out: Partial<Record<NumKey, number>> = {};
  for (const k of NUM_KEYS) {
    const n = num(props[k]);
    if (n !== undefined) out[k] = n;
  }
  if (isRecord(props.numbers)) {
    for (const k of NUM_KEYS) {
      const n = num(props.numbers[k]);
      if (n !== undefined) out[k] = n;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

// Manifest layer entries may declare an `asset` (not yet on ManifestLayer —
// read structurally). GEE ids per ruling L8.
type LayerAsset = ManifestLayer & { asset?: string };

// Layers declared for the case in the root manifest (canonical, hyphen event
// id, or the registered alias — synced manifests have used both key forms).
async function defaultManifestLayers(
  canonical: string,
  caseId: string
): Promise<LayerAsset[] | undefined> {
  const root = await getRootManifest();
  const alias = caseAlias(canonical);
  const entry =
    root?.cases?.[canonical] ??
    root?.cases?.[caseId] ??
    (alias ? root?.cases?.[alias] : undefined);
  return entry?.layers as LayerAsset[] | undefined;
}

function populationImage(ee: EeLike, popImage?: string): EeImageLike {
  const override = popImage ?? process.env.GEE_POP_IMAGE;
  if (override) return ee.Image(override);
  return ee.ImageCollection(GPW_COLLECTION)
    .sort("system:time_start", false)
    .first();
}

export interface NumbersServiceOptions {
  assetRoot?: string; // defaults to GEE_ASSET_ROOT / projects/$GEE_PROJECT/assets/tipping-point
  popImage?: string; // defaults to GEE_POP_IMAGE / latest of GPW v4 collection
  timeoutMs?: number; // defaults to GEE_NUMBERS_TIMEOUT_MS / 15000
  now?: () => number; // ms clock, injectable for cache tests
  ttlMs?: number;
  negTtlMs?: number;
  // Injectable manifest-layer lookup for tests; default reads the root
  // manifest via lib/data.
  manifestLayers?: (
    canonical: string,
    caseId: string
  ) => Promise<LayerAsset[] | undefined> | LayerAsset[] | undefined;
}

export interface NumbersService {
  getNumbers(query: NumbersQuery): Promise<NumbersResult>;
}

// Injectable service: pass the real ee module from earthEngine() or a fake
// that records Image/select/gte/reduceRegion/getInfo calls.
export function createNumbersService(
  ee: EeLike,
  opts: NumbersServiceOptions = {}
): NumbersService {
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? TTL_MS;
  const negTtl = opts.negTtlMs ?? NEG_TTL_MS;

  async function getNumbers({ caseId, date }: NumbersQuery): Promise<NumbersResult> {
    const canonical = canonicalCaseId(caseId);
    const key = `${canonical}|${date}`;
    const hit = cache.get(key);
    if (hit) {
      const age = now() - hit.issuedAt;
      if (hit.result && age < ttl) return hit.result;
      // Failures are negative-cached for 30 s: a missing band/asset (e.g. a
      // job that hasn't published the date yet) or an EE blip shouldn't cost
      // a fresh EE roundtrip on every request.
      if (hit.error && age < negTtl) throw hit.error;
      cache.delete(key);
    }

    try {
      const result = await compute(canonical, caseId, date);
      cache.set(key, { result, issuedAt: now() });
      return result;
    } catch (e) {
      cache.set(key, { error: e as Error, issuedAt: now() });
      throw e;
    }
  }

  async function compute(
    canonical: string,
    caseId: string,
    date: string
  ): Promise<NumbersResult> {
    const timeout = opts.timeoutMs ?? defaultTimeoutMs();
    const compact = date.replace(/-/g, "");
    const assetRoot = opts.assetRoot ?? defaultAssetRoot();

    const layers = opts.manifestLayers
      ? await opts.manifestLayers(canonical, caseId)
      : await defaultManifestLayers(canonical, caseId);
    const tpiEntry = layers?.find(
      (l) => l.id === "tpi_slide" && (l.date === date || l.date === compact)
    );
    const tpiAsset =
      tpiEntry?.asset ?? `${assetRoot}/${canonical}/tpi_slide_series`;

    const tpi = ee.Image(tpiAsset);
    const info = await getInfo(tpi, `getInfo on ${tpiAsset}`, timeout);
    const band = matchBand(info, date, tpiAsset);
    const props = propsOf(info);
    const dataDate = str(props.data_date) ?? str(props.updated_at);

    // Fast path: the job already reduced the numbers into asset properties.
    const fromProps = numbersFromProps(props);
    if (fromProps) {
      return {
        case: canonical,
        date,
        ...fromProps,
        ...(dataDate ? { data_date: dataDate } : {}),
        source: "properties",
      };
    }

    // Computed path: critical = TPI >= threshold on the date band.
    const critical = tpi.select(band).gte(TPI_THRESHOLD);
    const pop = populationImage(ee, opts.popImage);
    const [areaM2, people] = await Promise.all([
      reduceSum(
        ee,
        ee.Image.pixelArea().updateMask(critical),
        `reduceRegion area on ${tpiAsset}`,
        timeout
      ),
      reduceSum(
        ee,
        pop.updateMask(critical),
        `reduceRegion population on ${tpiAsset}`,
        timeout
      ),
    ]);

    const result: NumbersResult = {
      case: canonical,
      date,
      km2_critical: areaM2 / 1e6,
      people_exposed: people,
      source: "computed",
    };
    if (dataDate) result.data_date = dataDate;

    // flood_confirmed is optional per case — when the asset exists its
    // nonzero mask replaces the critical mask for the flooded pair.
    const floodEntry =
      layers?.find(
        (l) =>
          l.id === "flood_confirmed" &&
          (l.date === date || l.date === compact)
      ) ?? layers?.find((l) => l.id === "flood_confirmed");
    const floodAsset =
      floodEntry?.asset ?? `${assetRoot}/${canonical}/flood_confirmed`;
    const flood = ee.Image(floodAsset);
    const floodInfo = await getInfo(
      flood,
      `getInfo on ${floodAsset}`,
      timeout
    ).catch(() => undefined);
    if (floodInfo) {
      const fids = bandIds(floodInfo);
      const fband = fids.includes(compact)
        ? compact
        : fids.includes(date)
          ? date
          : undefined;
      const floodMask = (fband ? flood.select(fband) : flood).neq(0);
      const [fAreaM2, fPeople] = await Promise.all([
        reduceSum(
          ee,
          ee.Image.pixelArea().updateMask(floodMask),
          `reduceRegion area on ${floodAsset}`,
          timeout
        ),
        reduceSum(
          ee,
          pop.updateMask(floodMask),
          `reduceRegion population on ${floodAsset}`,
          timeout
        ),
      ]);
      result.flooded_km2 = fAreaM2 / 1e6;
      result.people_flooded = fPeople;
    }

    return result;
  }

  return { getNumbers };
}

// Test hook — lets route tests drive 404/200 paths without real creds.
let serviceForTest: NumbersService | undefined;
export function setNumbersServiceForTest(
  svc: NumbersService | undefined
): void {
  serviceForTest = svc;
}

// Credentialed entry point used by the route. Checks the env chain first so a
// missing key is a CredsError (503), not an init failure.
export async function getNumbers(query: NumbersQuery): Promise<NumbersResult> {
  if (!credentialEnv()) {
    throw new CredsError(
      "no service-account key (set GCP_SA_KEY or GEE_SERVICE_ACCOUNT_KEY)"
    );
  }
  if (serviceForTest) return serviceForTest.getNumbers(query);
  let eeClient: EeLike;
  try {
    eeClient = (await earthEngine()) as unknown as EeLike;
  } catch (e) {
    throw new NumbersServiceError(`gee init failed: ${errMessage(e)}`);
  }
  return createNumbersService(eeClient).getNumbers(query);
}
