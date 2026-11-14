import { canonicalCaseId, type MetricsV4 } from "./contract";
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
] as const;

export type ValidationMetrics = Pick<MetricsV4, (typeof NUM_KEYS)[number]> & {
  flood_source?: "nisar" | "opera" | "observed" | null;
};

export interface MetricsQuery {
  caseId: string;
}

export interface MetricsResult {
  case: string;
  canonical: string;
  data_date: string;
  updated_at: string;
  metrics: ValidationMetrics;
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

export function createMetricsService(
  ee: EeLike,
  opts: MetricsServiceOptions = {}
): MetricsService {
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? TTL_MS;
  const negTtl = opts.negTtlMs ?? NEG_TTL_MS;

  async function getMetrics({ caseId }: MetricsQuery): Promise<MetricsResult> {
    const canonical = canonicalCaseId(caseId);
    const hit = cache.get(canonical);
    if (hit) {
      const age = now() - hit.issuedAt;
      if (hit.result && age < ttl) return { ...hit.result, case: caseId };
      if (hit.error && age < negTtl) throw hit.error;
      cache.delete(canonical);
    }

    try {
      const asset = `${opts.assetRoot ?? eeAssetRoot()}/${canonical}/metrics`;
      const info = await withTimeout(
        imageInfo(ee.Image(asset), `getInfo on ${asset}`),
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
        if (typeof value === "number" && Number.isFinite(value)) metrics[key] = value;
      }
      const source = props.flood_source;
      if (source === null || source === "nisar" || source === "opera" || source === "observed") {
        metrics.flood_source = source;
      }
      const result = {
        canonical,
        data_date: props.data_date,
        updated_at: props.updated_at,
        metrics,
      };
      cache.set(canonical, { result, issuedAt: now() });
      return { ...result, case: caseId };
    } catch (error) {
      const mapped = metricsError(error);
      if (mapped instanceof MetricsNotFoundError || mapped instanceof MetricsTimeoutError) {
        cache.set(canonical, { error: mapped, issuedAt: now() });
      }
      throw mapped;
    }
  }

  return { getMetrics };
}

let service: MetricsService | undefined;
let serviceForTest: MetricsService | undefined;

export function setMetricsServiceForTest(value: MetricsService | undefined): void {
  serviceForTest = value;
}

export async function getMetrics(query: MetricsQuery): Promise<MetricsResult> {
  if (!credentialEnv()) {
    throw new CredsError("no service-account key (set GCP_SA_KEY or GEE_SERVICE_ACCOUNT_KEY)");
  }
  if (serviceForTest) return serviceForTest.getMetrics(query);
  if (!service) {
    try {
      const ee = await withTimeout(earthEngine(), defaultTimeoutMs(), "gee init");
      service = createMetricsService(ee as unknown as EeLike);
    } catch (error) {
      if (error instanceof TileServiceError && error.message.startsWith("timeout")) {
        throw new MetricsTimeoutError(error.message);
      }
      throw new MetricsServiceError(`gee init failed: ${errMessage(error)}`);
    }
  }
  return service.getMetrics(query);
}
