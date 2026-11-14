// Live Earth Engine map tiles: one band per day on a `<case>_<layer>_series`
// asset, classified server-side into the 4 TPI doc classes and returned as a
// getMapId tile-URL template. Requires service-account creds (see lib/ee);
// tests inject a fake ee via createTileService.
import { credentialEnv, earthEngine } from "./ee";
import { canonicalCaseId } from "./contract";
import { TPI_CLASSES } from "./tpi";

export const TILE_LAYERS = ["tpi_slide", "tpi_flood"] as const;
export type TileLayer = (typeof TILE_LAYERS)[number];

export interface TileQuery {
  layer: TileLayer;
  caseId: string;
  date: string; // band name on the *_series asset: YYYY-MM-DD
}

export interface TileResult {
  tiles: string[]; // urlFormat template(s), {z}/{x}/{y} placeholders intact
  expires_at: string; // ISO — cache lifetime, not the EE mapid lease
}

export class CredsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredsError";
  }
}

// Missing asset / band / date — the route maps this to 404.
export class TileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TileNotFoundError";
  }
}

// Wrapped ee init/compute failure — the route maps this to 502.
export class TileServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TileServiceError";
  }
}

// The ee module shape the service needs — the real module from earthEngine()
// or a test fake (cast to this type).
export type EeClient = Awaited<ReturnType<typeof earthEngine>>;
type EeImage = ReturnType<EeClient["Image"]>;
type EeMapId = { urlFormat?: string; url_format?: string };

const TTL_MS = 2 * 60 * 60 * 1000; // 2 h
const REFRESH_SKEW_MS = 5 * 60 * 1000; // refetch slightly early, never serve stale
// Class cuts and palette come from TPI_CLASSES: classes 1..3 (moderate,
// high, critical) get painted; class 0 (Low) is masked transparent.
const CUTS = TPI_CLASSES.slice(1).map((c) => c.min);
const PALETTE = TPI_CLASSES.slice(1).map((c) => c.color);

interface CacheEntry {
  tiles: string[];
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
      ? `projects/${process.env.GEE_PROJECT}/assets/tpi`
      : "tpi")
  );
}

const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

// EE "object doesn't exist" style failures read as 404s; anything else is a
// compute/transport failure (502 at the route).
const NOT_FOUND_RE = /not found|does not exist|no such|unknown asset|failed to find/i;
function mapComputeError(err: unknown, context: string): Error {
  const msg = `${context}: ${errMessage(err)}`;
  return NOT_FOUND_RE.test(msg)
    ? new TileNotFoundError(msg)
    : new TileServiceError(msg);
}

function bandNames(img: EeImage, asset: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    try {
      img.bandNames().getInfo((data, err) => {
        if (err) return reject(mapComputeError(err, `bandNames on ${asset}`));
        resolve(Array.isArray(data) ? data.map(String) : []);
      });
    } catch (e) {
      reject(mapComputeError(e, `bandNames on ${asset}`));
    }
  });
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

export interface TileServiceOptions {
  assetRoot?: string; // defaults to GEE_ASSET_ROOT / projects/$GEE_PROJECT/assets/tpi
  now?: () => number; // ms clock, injectable for cache tests
  ttlMs?: number;
  refreshSkewMs?: number;
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

  async function getTiles({ layer, caseId, date }: TileQuery): Promise<TileResult> {
    const canonical = canonicalCaseId(caseId);
    const key = `${layer}|${canonical}|${date}`;
    const hit = cache.get(key);
    if (hit && now() - hit.issuedAt < ttl - skew) {
      return {
        tiles: hit.tiles,
        expires_at: new Date(hit.issuedAt + ttl).toISOString(),
      };
    }

    const asset = `${opts.assetRoot ?? defaultAssetRoot()}/${canonical}_${layer}_series`;
    const img = eeClient.Image(asset);
    const bands = await bandNames(img, asset);
    if (!bands.includes(date)) {
      throw new TileNotFoundError(`no band ${date} on ${asset}`);
    }

    // Bin TPI 0..1 into the 4 doc classes at the class mins → integer raster
    // 0–3; mask class 0 (Low renders transparent); paint moderate→critical.
    const tpi = img.select(date);
    let cls = tpi.gt(CUTS[0]);
    for (const cut of CUTS.slice(1)) cls = cls.add(tpi.gt(cut));
    const vis = cls
      .updateMask(cls.gt(0))
      .visualize({ min: 1, max: 3, palette: PALETTE });

    const map = await getMapId(vis, asset);
    const url = map.urlFormat ?? map.url_format;
    if (!url) {
      throw new TileServiceError(`getMapId on ${asset} returned no tile url`);
    }

    const issuedAt = now();
    cache.set(key, { tiles: [url], issuedAt });
    return { tiles: [url], expires_at: new Date(issuedAt + ttl).toISOString() };
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
