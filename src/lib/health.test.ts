// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { afterEach, describe, expect, test } from "bun:test";

import { GET } from "../app/api/health/route";
import {
  collectHealth,
  HEALTH_ENV_VARS,
  setHealthDepsForTest,
  type HealthDeps,
} from "./health";
import type { RootManifest } from "./types";

// Fake ee: Image() returns an object whose getInfo resolves, errors, or hangs.
function makeFakeEe(o: { error?: string; hang?: boolean } = {}) {
  const calls: string[] = [];
  const ee = {
    Image(id: string) {
      calls.push(id);
      return {
        getInfo(cb: (d: unknown, e?: string) => void) {
          if (o.hang) return;
          if (o.error) return cb(undefined, o.error);
          cb({ bands: [{ id: "elevation" }] });
        },
      };
    },
  };
  return { ee, calls };
}

// Sentinel values: the report must never contain an env value anywhere.
const SENTINELS: Record<string, string> = {
  GCP_SA_KEY: "sentinel-sa-key-value",
  GEE_PROJECT: "sentinel-project",
  GEE_ASSET_ROOT: "sentinel-asset-root",
  DATA_BASE_URL: "sentinel-data-url",
  TELEGRAM_TOKEN: "sentinel-tg-token",
  TELEGRAM_SECRET: "sentinel-tg-secret",
};

const envFrom = (set: Record<string, string>) => (n: string) => set[n];

function deps(over: HealthDeps = {}): HealthDeps {
  return {
    env: envFrom(SENTINELS),
    hasCreds: () => true,
    ee: () => Promise.resolve(makeFakeEe().ee),
    readManifest: () => Promise.resolve(undefined),
    timeoutMs: 20,
    ...over,
  };
}

describe("collectHealth", () => {
  test("env booleans are true per present var, and no value ever leaks", async () => {
    const report = await collectHealth(deps());
    for (const k of HEALTH_ENV_VARS) expect(report.env[k]).toBe(true);
    const json = JSON.stringify(report);
    for (const v of Object.values(SENTINELS)) {
      expect(json).not.toContain(v);
    }
  });

  test("env booleans are false for absent vars", async () => {
    const report = await collectHealth(deps({ env: () => undefined }));
    for (const k of HEALTH_ENV_VARS) expect(report.env[k]).toBe(false);
    expect(report.ok).toBe(false);
  });

  test("partial env presence reports per-var", async () => {
    const report = await collectHealth(
      deps({ env: envFrom({ GCP_SA_KEY: "x", GEE_PROJECT: "y" }) })
    );
    expect(report.env.GCP_SA_KEY).toBe(true);
    expect(report.env.GEE_PROJECT).toBe(true);
    expect(report.env.TELEGRAM_TOKEN).toBe(false);
  });

  test("ok is env.GCP_SA_KEY && gee.ready", async () => {
    const ready = await collectHealth(deps());
    expect(ready.ok).toBe(true);
    // creds but probe fails -> ok false
    const notReady = await collectHealth(
      deps({ ee: () => Promise.resolve(makeFakeEe({ error: "boom" }).ee) })
    );
    expect(notReady.ok).toBe(false);
    expect(notReady.gee.ready).toBe(false);
    expect(notReady.gee.reason).toContain("boom");
  });

  test("gee ready on fake ee resolving, latency recorded", async () => {
    const { ee, calls } = makeFakeEe();
    const report = await collectHealth(deps({ ee: () => Promise.resolve(ee) }));
    expect(report.gee.ready).toBe(true);
    expect(report.gee.reason).toBeNull();
    expect(typeof report.gee.latency_ms).toBe("number");
    expect(calls).toContain("NASA/NASADEM_HGT/001");
  });

  test("hung probe -> ready=false with timeout reason", async () => {
    const { ee } = makeFakeEe({ hang: true });
    const report = await collectHealth(
      deps({ ee: () => Promise.resolve(ee), timeoutMs: 5 })
    );
    expect(report.gee.ready).toBe(false);
    expect(report.gee.reason).toContain("timeout");
  });

  test("no creds -> probe skipped, latency null", async () => {
    let eeCalled = false;
    const report = await collectHealth(
      deps({
        hasCreds: () => false,
        ee: () => {
          eeCalled = true;
          return Promise.resolve(makeFakeEe().ee);
        },
      })
    );
    expect(report.gee).toEqual({
      ready: false,
      latency_ms: null,
      reason: "no service-account key",
    });
    expect(eeCalled).toBe(false);
    expect(report.ok).toBe(false);
  });

  test("manifest cases echo updated_at, including now", async () => {
    const manifest: RootManifest = {
      updated_at: "2026-11-01T00:00:00Z",
      cases: {
        rs_2024: { updated_at: "2024-06-01T00:00:00Z" },
        wa_2025: {},
        now: { updated_at: "2026-11-14T00:00:00Z" },
      },
    };
    const report = await collectHealth(
      deps({ readManifest: () => Promise.resolve(manifest) })
    );
    expect(report.data.manifest).toBe(true);
    expect(report.data.cases.rs_2024.updated_at).toBe("2024-06-01T00:00:00Z");
    // missing per-case stamp falls back to the root updated_at
    expect(report.data.cases.wa_2025.updated_at).toBe("2026-11-01T00:00:00Z");
    expect(report.data.now.updated_at).toBe("2026-11-14T00:00:00Z");
  });

  test("manifest reader throwing -> manifest=false, cases={}", async () => {
    const report = await collectHealth(
      deps({
        readManifest: () => Promise.reject(new Error("disk gone")),
      })
    );
    expect(report.data.manifest).toBe(false);
    expect(report.data.cases).toEqual({});
    expect(report.data.now).toEqual({ updated_at: null });
  });
});

describe("GET /api/health", () => {
  afterEach(() => setHealthDepsForTest(undefined));

  test("always 200: healthy", async () => {
    setHealthDepsForTest(deps());
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("always 200: no creds and manifest failure", async () => {
    setHealthDepsForTest(
      deps({
        env: () => undefined,
        hasCreds: () => false,
        readManifest: () => Promise.reject(new Error("nope")),
      })
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.gee.reason).toBe("no service-account key");
    expect(body.data.manifest).toBe(false);
  });
});
