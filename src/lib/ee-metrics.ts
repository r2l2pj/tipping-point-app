import { canonicalCaseId, type MetricsV4 } from "./contract";
import { getMetrics as getManifestMetrics } from "./data";
import { credentialEnv, earthEngine } from "./ee";
import {
  CredsError,
  eeAssetRoot,
  errMessage,
  imageInfo,
  mapComputeError,
  TileNotFoundError,
  TileServiceError,
  withTimeout,
} from "./ee-shared";

export { CredsError } from "./ee-shared";

export class MetricsNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetricsNotFoundError";
  }
}

export class MetricsTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetricsTimeoutError";
  }
}

export class MetricsServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetricsServiceError";
  }
}

// Both sources failed to answer: the manifest read threw AND the GEE
// overlay was never attempted (no credentials) or errored. Route -> 503.
export class MetricsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetricsUnavailableError";
  }
}

const NUM_KEYS = [
  "iou",
  "f1",
  "cloud_pct",
  "landslide_hit_pct",
  "hand_validation",
  "night_light_drop_pct",
  "lead_time_mean_h",
  "lead_time_median_h",
  "warned_before_pct",
  "warned_24h_pct",
  "never_critical_pct",
  "n_points",
  "event_lead_h",
  "critical_area_km2",
  "critical_area_with_damage_pct",
] as const;

// Scalar keys the GEE overlay may carry. MetricsV4 does not declare the
// lead-time keys yet (contract merge still landing), so they are typed
// locally; runtime picking is string-based either way.
export type ValidationMetrics = Pick<MetricsV4, (typeof NUM_KEYS)[number] & keyof MetricsV4> & {
  warned_24h_pct?: number;
  never_critical_pct?: number;
  n_points?: number;
  event_lead_h?: number;
  critical_area_km2?: number;
  critical_area_with_damage_pct?: number;
  anchor_precision?: "hour" | "date" | "mixed";
  official_warning_delta_h?: number | null;
  flood_source?: "nisar" | "opera" | "observed" | null;
};

export type MetricSource = "manifest" | "gee";

export interface MetricsQuery {
  caseId: string;
}

export interface MetricsResult {
  case: string;
  canonical: string;
  data_date: string | null;
  updated_at: string | null;
  sources: MetricSource[];
  // flood_source is Omit-ed: the overlay widens it to include null.
  metrics: Omit<MetricsV4, "flood_source"> & ValidationMetrics;
}

export interface EeLike {
  Image(id: string): {
    getInfo(callback: (data: unknown, error?: string) => void): void;
  };
}

export interface MetricsServiceOptions {
  assetRoot?: string;
  timeoutMs?: number;
  now?: () => number;
  ttlMs?: number;
  negTtlMs?: number;
  // Static manifest fragment reader (metrics.json#<case>). Undefined means
  // "the manifest has no data for this case"; a throw means the read failed.
  readManifest?: (canonical: string) => Promise<MetricsV4 | undefined>;
}

export interface MetricsService {
  getMetrics(query: MetricsQuery): Promise<MetricsResult>;
}

interface CacheEntry {
  result?: Omit<MetricsResult, "case">;
  error?: Error;
  issuedAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000;
const NEG_TTL_MS = 30 * 1000;
const DEFAULT_TIMEOUT_MS = 8_000;

export function clearMetricsCache(): void {
  cache.clear();
}

function defaultTimeoutMs(): number {
  const timeout = Number(process.env.GEE_TIMEOUT_MS);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS;
}

function metricsError(error: unknown): Error {
  if (error instanceof MetricsServiceError) return error;
  const mapped = error instanceof TileNotFoundError || error instanceof TileServiceError
    ? error
    : mapComputeError(error, "metrics");
  if (mapped instanceof TileNotFoundError) {
    return new MetricsNotFoundError(mapped.message);
  }
  return mapped.message.startsWith("timeout")
    ? new MetricsTimeoutError(mapped.message)
    : new MetricsServiceError(mapped.message);
}

// Default manifest reader: data.getMetrics throws "data: metrics for <id>
// not found" when no fragment resolves — that is an absent fragment, not a
// read failure. Anything else propagates as a failure.
async function defaultReadManifest(canonical: string): Promise<MetricsV4 | undefined> {
  try {
    const metrics = (await getManifestMetrics(canonical)) as MetricsV4;
    return metrics && Object.keys(metrics).length > 0 ? metrics : undefined;
  } catch (error) {
    if (error instanceof Error && /not found$/.test(error.message)) return undefined;
    throw error;
  }
}

// ee === undefined means "no GEE overlay configured" (e.g. no credentials);
// the manifest path must still answer on its own.
export function createMetricsService(
  ee?: EeLike,
  opts: MetricsServiceOptions = {}
): MetricsService {
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? TTL_MS;
  const negTtl = opts.negTtlMs ?? NEG_TTL_MS;
  const readManifest = opts.readManifest ?? defaultReadManifest;

  async function fetchOverlay(canonical: string): Promise<{
    data_date: string;
    updated_at: string;
    metrics: ValidationMetrics;
  }> {
    const asset = `${opts.assetRoot ?? eeAssetRoot()}/${canonical}/metrics`;
    const info = await withTimeout(
      imageInfo(ee!.Image(asset), `getInfo on ${asset}`),
      opts.timeoutMs ?? defaultTimeoutMs(),
      asset
    );
    const props = info.properties ?? {};
    if (typeof props.data_date !== "string" || typeof props.updated_at !== "string") {
      throw new MetricsServiceError("metrics asset missing data_date or updated_at");
    }
    const metrics: ValidationMetrics = {};
    for (const key of NUM_KEYS) {
      const value = props[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        (metrics as Record<string, unknown>)[key] = value;
      }
    }
    const source = props.flood_source;
    if (source === null || source === "nisar" || source === "opera" || source === "observed") {
      metrics.flood_source = source;
    }
    const precision = props.anchor_precision;
    if (precision === "hour" || precision === "date" || precision === "mixed") {
      metrics.anchor_precision = precision;
    }
    const delta = props.official_warning_delta_h;
    if (delta === null || (typeof delta === "number" && Number.isFinite(delta))) {
      metrics.official_warning_delta_h = delta;
    }
    return { data_date: props.data_date, updated_at: props.updated_at, metrics };
  }

  async function getMetrics({ caseId }: MetricsQuery): Promise<MetricsResult> {
    const canonical = canonicalCaseId(caseId);
    const hit = cache.get(canonical);
    if (hit) {
      const age = now() - hit.issuedAt;
      if (hit.result && age < ttl) return { ...hit.result, case: caseId };
      if (hit.error && age < negTtl) throw hit.error;
      cache.delete(canonical);
    }

    let manifest: MetricsV4 | undefined;
    let manifestFailed = false;
    try {
      manifest = await readManifest(canonical);
    } catch {
      manifestFailed = true;
    }

    let overlay: Awaited<ReturnType<typeof fetchOverlay>> | undefined;
    let overlayError: Error | undefined;
    if (ee) {
      try {
        overlay = await fetchOverlay(canonical);
      } catch (error) {
        overlayError = metricsError(error);
      }
    }

    if (manifest !== undefined || overlay !== undefined) {
      const sources: MetricSource[] = [];
      if (manifest !== undefined) sources.push("manifest");
      if (overlay !== undefined) sources.push("gee");
      const result = {
        canonical,
        data_date: overlay?.data_date ?? null,
        updated_at: overlay?.updated_at ?? null,
        sources,
        metrics: { ...(manifest ?? {}), ...(overlay?.metrics ?? {}) },
      };
      cache.set(canonical, { result, issuedAt: now() });
      return { ...result, case: caseId };
    }

    // Neither source produced data.
    let error: Error;
    if (manifestFailed) {
      error = new MetricsUnavailableError(
        overlayError
          ? `manifest read failed and gee overlay failed: ${overlayError.message}`
          : "manifest read failed and gee overlay unavailable"
      );
    } else if (overlayError) {
      error = overlayError;
    } else {
      error = new CredsError(
        "no manifest metrics and no service-account key (set GCP_SA_KEY or GEE_SERVICE_ACCOUNT_KEY)"
      );
    }
    if (error instanceof MetricsNotFoundError || error instanceof MetricsUnavailableError) {
      cache.set(canonical, { error, issuedAt: now() });
    }
    throw error;
  }

  return { getMetrics };
}

let service: MetricsService | undefined;
let serviceForTest: MetricsService | undefined;

export function setMetricsServiceForTest(value: MetricsService | undefined): void {
  serviceForTest = value;
}

export async function getMetrics(query: MetricsQuery): Promise<MetricsResult> {
  if (serviceForTest) return serviceForTest.getMetrics(query);
  if (!service) {
    let ee: EeLike | undefined;
    if (credentialEnv()) {
      try {
        ee = (await withTimeout(earthEngine(), defaultTimeoutMs(), "gee init")) as unknown as EeLike;
      } catch (error) {
        if (error instanceof TileServiceError && error.message.startsWith("timeout")) {
          throw new MetricsTimeoutError(error.message);
        }
        throw new MetricsServiceError(`gee init failed: ${errMessage(error)}`);
      }
    }
    service = createMetricsService(ee);
  }
  return service.getMetrics(query);
}
