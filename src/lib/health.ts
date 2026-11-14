// Health report for GET /api/health. Always 200 — it reports, never gates.
// env reports booleans only: a var is present or not, never its value.
import { credentialEnv, earthEngine } from "./ee";
import { errMessage, imageInfo, withTimeout } from "./ee-shared";
import { getRootManifest } from "./data";
import type { RootManifest } from "./types";

export const HEALTH_ENV_VARS = [
  "GCP_SA_KEY",
  "GEE_PROJECT",
  "GEE_ASSET_ROOT",
  "DATA_BASE_URL",
  "TELEGRAM_TOKEN",
  "TELEGRAM_SECRET",
] as const;

// Public asset confirmed readable; a cheap getInfo proves the EE session.
const PROBE_ASSET = "NASA/NASADEM_HGT/001";
const DEFAULT_TIMEOUT_MS = 8000;

interface EeLike {
  Image(id: string): { getInfo(cb: (d: unknown, e?: string) => void): void };
}

export interface HealthDeps {
  env?: (name: string) => string | undefined;
  ee?: () => Promise<EeLike>;
  hasCreds?: () => boolean;
  readManifest?: () => Promise<RootManifest | undefined>;
  now?: () => number;
  timeoutMs?: number;
}

export interface HealthReport {
  ok: boolean;
  env: Record<(typeof HEALTH_ENV_VARS)[number], boolean>;
  gee: { ready: boolean; latency_ms: number | null; reason: string | null };
  data: {
    cases: Record<string, { updated_at: string | null }>;
    now: { updated_at: string | null };
    manifest: boolean;
  };
}

// Test seam: the route reads deps from here so tests can inject fakes
// without mutating process.env or holding real credentials.
let routeDeps: HealthDeps | undefined;
export function setHealthDepsForTest(d: HealthDeps | undefined): void {
  routeDeps = d;
}
export const healthDeps = () => routeDeps ?? {};

export async function collectHealth(deps: HealthDeps = {}): Promise<HealthReport> {
  const env = deps.env ?? ((n: string) => process.env[n]);
  const hasCreds = deps.hasCreds ?? (() => credentialEnv() !== null);
  const eeFactory = deps.ee ?? (() => earthEngine() as Promise<unknown> as Promise<EeLike>);
  const readManifest = deps.readManifest ?? getRootManifest;
  const now = deps.now ?? Date.now;
  const timeoutMs =
    deps.timeoutMs ??
    (Number(env("GEE_HEALTH_TIMEOUT_MS")) || DEFAULT_TIMEOUT_MS);

  const envBools = Object.fromEntries(
    HEALTH_ENV_VARS.map((k) => [k, Boolean(env(k))])
  ) as HealthReport["env"];

  const gee: HealthReport["gee"] = { ready: false, latency_ms: null, reason: null };
  if (!hasCreds()) {
    gee.reason = "no service-account key";
  } else {
    const start = now();
    try {
      const ee = await eeFactory();
      await withTimeout(
        imageInfo(ee.Image(PROBE_ASSET), "health probe"),
        timeoutMs,
        "health probe"
      );
      gee.ready = true;
      gee.latency_ms = now() - start;
    } catch (e) {
      gee.reason = errMessage(e);
      gee.latency_ms = now() - start;
    }
  }

  const data: HealthReport["data"] = { cases: {}, now: { updated_at: null }, manifest: false };
  try {
    const manifest = await readManifest();
    if (manifest) {
      data.manifest = true;
      for (const [id, entry] of Object.entries(manifest.cases ?? {})) {
        const u = entry?.updated_at;
        data.cases[id] = { updated_at: typeof u === "string" ? u : null };
      }
      const u = manifest.cases?.now?.updated_at;
      data.now = { updated_at: typeof u === "string" ? u : null };
    }
  } catch {
    // manifest read failure reports manifest=false, cases={}
  }

  return { ok: envBools.GCP_SA_KEY && gee.ready, env: envBools, gee, data };
}
