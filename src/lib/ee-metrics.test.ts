// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a dependency.
import { afterEach, describe, expect, test } from "bun:test";
import { GET } from "../app/api/metrics/route";
import {
  clearMetricsCache,
  createMetricsService,
  CredsError,
  type EeLike,
  getMetrics,
  MetricsNotFoundError,
  MetricsTimeoutError,
  setMetricsServiceForTest,
} from "./ee-metrics";

const DATES = { data_date: "2024-05-01", updated_at: "2024-05-02T12:00:00Z" };
const QUERY = { caseId: "rs-2024-05" };

function fakeEe(opts: {
  props?: Record<string, unknown>;
  error?: string;
  hang?: boolean;
  throws?: boolean;
} = {}) {
  const assets: string[] = [];
  let reads = 0;
  const ee: EeLike = {
    Image(id) {
      assets.push(id);
      if (opts.throws) throw new Error(opts.error ?? "Image not found");
      return {
        getInfo(callback) {
          reads++;
          if (opts.hang) return;
          callback(
            { bands: [{ id: "metrics" }], properties: { ...DATES, ...opts.props } },
            opts.error
          );
        },
      };
    },
  };
  return { ee, assets, reads: () => reads };
}

async function withEnv<T>(values: Record<string, string | undefined>, fn: () => Promise<T>) {
  const saved = Object.keys(values).map((key) => [key, process.env[key]] as const);
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const req = (query = "case=rs-2024-05") => new Request(`http://localhost/api/metrics?${query}`);

async function routeWithFake(opts: Parameters<typeof fakeEe>[0] = {}) {
  const fake = fakeEe(opts);
  setMetricsServiceForTest(createMetricsService(fake.ee, { assetRoot: "root", timeoutMs: 5 }));
  return withEnv({ GCP_SA_KEY: "test-key" }, () => GET(req()));
}

afterEach(() => {
  clearMetricsCache();
  setMetricsServiceForTest(undefined);
});

describe("GET /api/metrics", () => {
  test("missing or empty case returns 400", async () => {
    for (const query of ["", "case="]) {
      const response = await GET(req(query));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("case");
    }
  });

  test("no credentials returns 503", async () => {
    const response = await withEnv(
      { GCP_SA_KEY: undefined, GEE_SERVICE_ACCOUNT_KEY: undefined },
      () => GET(req())
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("gee unavailable");
  });

  test("hung getInfo returns 503", async () => {
    expect((await routeWithFake({ hang: true })).status).toBe(503);
  });

  test("missing asset returns 404", async () => {
    expect((await routeWithFake({ error: "Image asset does not exist" })).status).toBe(404);
  });

  test("compute failure returns 502", async () => {
    expect((await routeWithFake({ error: "quota exceeded" })).status).toBe(502);
  });

  test("200 echoes dates and ids, passes numeric metrics verbatim, and drops other keys", async () => {
    const metrics = {
      iou: 0.75,
      f1: 0.8,
      cloud_pct: 80,
      landslide_hit_pct: 0,
      hand_validation: 95,
      night_light_drop_pct: 32.5,
      lead_time_mean_h: 12,
      lead_time_median_h: 9.5,
      warned_before_pct: 88,
      flood_source: "nisar",
    };
    const response = await routeWithFake({ props: {
      ...metrics,
      people_critical: 123,
      people_flooded: 12,
      people_exposed: 456,
      flooded_km2: 4,
      rf_auc: 0.9,
      rule_auc: 0.6,
      feature_importance: { rain: 1 },
      "system:index": "metrics",
    } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      case: "rs-2024-05", canonical: "rs_2024", ...DATES, metrics,
    });
  });

  test("absent metrics are omitted and null flood_source is retained", async () => {
    const response = await routeWithFake({ props: { iou: 0, flood_source: null } });
    expect(await response.json()).toEqual({
      case: "rs-2024-05", canonical: "rs_2024", ...DATES,
      metrics: { iou: 0, flood_source: null },
    });
  });

  test("fallback credential env works without a real key", async () => {
    const fake = fakeEe();
    setMetricsServiceForTest(createMetricsService(fake.ee));
    const response = await withEnv(
      { GCP_SA_KEY: undefined, GEE_SERVICE_ACCOUNT_KEY: "test-key" },
      () => GET(req())
    );
    expect(response.status).toBe(200);
  });
});

describe("createMetricsService", () => {
  test("canonical cache avoids another getInfo but echoes each requested id", async () => {
    const fake = fakeEe({ props: { f1: 0.9 } });
    const service = createMetricsService(fake.ee, { assetRoot: "root" });
    expect((await service.getMetrics(QUERY)).case).toBe("rs-2024-05");
    expect((await service.getMetrics({ caseId: "rs_2024" })).case).toBe("rs_2024");
    expect(fake.assets).toEqual(["root/rs_2024/metrics"]);
    expect(fake.reads()).toBe(1);
  });

  test("success expires after ten minutes", async () => {
    let now = 0;
    const fake = fakeEe();
    const service = createMetricsService(fake.ee, { now: () => now });
    await service.getMetrics(QUERY);
    now = 599_999;
    await service.getMetrics(QUERY);
    expect(fake.reads()).toBe(1);
    now = 600_000;
    await service.getMetrics(QUERY);
    expect(fake.reads()).toBe(2);
  });

  for (const [label, opts, ErrorType] of [
    ["404", { error: "asset not found" }, MetricsNotFoundError],
    ["503", { hang: true }, MetricsTimeoutError],
  ] as const) {
    test(`${label} negative cache preserves class and expires after thirty seconds`, async () => {
      let now = 0;
      const fake = fakeEe(opts);
      const service = createMetricsService(fake.ee, { now: () => now, timeoutMs: 5 });
      const first = await service.getMetrics(QUERY).catch((error: unknown) => error);
      expect(first).toBeInstanceOf(ErrorType);
      now = 29_999;
      expect(await service.getMetrics(QUERY).catch((error: unknown) => error)).toBe(first);
      expect(fake.reads()).toBe(1);
      now = 30_000;
      expect(await service.getMetrics(QUERY).catch((error: unknown) => error)).toBeInstanceOf(ErrorType);
      expect(fake.reads()).toBe(2);
    });
  }

  test("502 failures are not cached", async () => {
    const fake = fakeEe({ error: "quota exceeded" });
    const service = createMetricsService(fake.ee);
    await service.getMetrics(QUERY).catch(() => {});
    await service.getMetrics(QUERY).catch(() => {});
    expect(fake.reads()).toBe(2);
  });

  test("synchronous Image errors map to not found", async () => {
    const fake = fakeEe({ throws: true });
    const error = await createMetricsService(fake.ee).getMetrics(QUERY).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(MetricsNotFoundError);
  });

  test("GEE_TIMEOUT_MS config bounds getInfo", async () => {
    const fake = fakeEe({ hang: true });
    await withEnv({ GEE_TIMEOUT_MS: "5" }, async () => {
      const error = await createMetricsService(fake.ee).getMetrics(QUERY).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(MetricsTimeoutError);
      expect((error as Error).message).toContain("5ms");
    });
  });

  test("opera and observed flood_source values pass through", async () => {
    for (const flood_source of ["opera", "observed"] as const) {
      clearMetricsCache();
      const fake = fakeEe({ props: { flood_source } });
      expect((await createMetricsService(fake.ee).getMetrics(QUERY)).metrics).toEqual({ flood_source });
    }
  });

  test("credentialed entry rejects absent credentials", async () => {
    const error = await withEnv(
      { GCP_SA_KEY: undefined, GEE_SERVICE_ACCOUNT_KEY: undefined },
      () => getMetrics(QUERY).catch((error: unknown) => error)
    );
    expect(error).toBeInstanceOf(CredsError);
  });
});
