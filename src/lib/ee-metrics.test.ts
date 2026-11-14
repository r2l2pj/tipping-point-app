// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a dependency.
import { afterEach, describe, expect, test } from "bun:test";
import { GET } from "../app/api/metrics/route";
import type { MetricsV4 } from "./contract";
import {
  clearMetricsCache,
  createMetricsService,
  type EeLike,
  getMetrics,
  MetricsNotFoundError,
  MetricsServiceError,
  MetricsTimeoutError,
  MetricsUnavailableError,
  setMetricsEeFactoryForTest,
  setMetricsServiceForTest,
} from "./ee-metrics";
import { TileServiceError } from "./ee-shared";

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

const noManifest = () => Promise.resolve(undefined);
const manifestOf = (m: MetricsV4) => () => Promise.resolve(m);
const failingManifest = () => Promise.reject(new Error("disk gone"));

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

async function routeWithFake(
  opts: Parameters<typeof fakeEe>[0] = {},
  readManifest: () => Promise<MetricsV4 | undefined> = noManifest
) {
  const fake = fakeEe(opts);
  setMetricsServiceForTest(
    createMetricsService(fake.ee, { assetRoot: "root", timeoutMs: 5, readManifest })
  );
  return GET(req());
}

afterEach(() => {
  clearMetricsCache();
  setMetricsServiceForTest(undefined);
  setMetricsEeFactoryForTest(undefined);
});

describe("GET /api/metrics", () => {
  test("missing or empty case returns 400", async () => {
    for (const query of ["", "case="]) {
      const response = await GET(req(query));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("case");
    }
  });

  test("no credentials still answers 200 from the manifest", async () => {
    setMetricsServiceForTest(
      createMetricsService(undefined, {
        readManifest: manifestOf({ iou: 0.5, lead_time_median_h: 46 }),
      })
    );
    const response = await withEnv(
      { GCP_SA_KEY: undefined, GEE_SERVICE_ACCOUNT_KEY: undefined },
      () => GET(req())
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sources).toEqual(["manifest"]);
    expect(body.data_date).toBeNull();
    expect(body.metrics.iou).toBe(0.5);
  });

  test("no credentials and no manifest data returns 503", async () => {
    setMetricsServiceForTest(createMetricsService(undefined, { readManifest: noManifest }));
    const response = await withEnv(
      { GCP_SA_KEY: undefined, GEE_SERVICE_ACCOUNT_KEY: undefined },
      () => GET(req())
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("metrics unavailable");
  });

  test("hung getInfo with no manifest data returns 503", async () => {
    expect((await routeWithFake({ hang: true })).status).toBe(503);
  });

  test("hung getInfo is rescued by manifest data", async () => {
    const response = await routeWithFake(
      { hang: true },
      manifestOf({ iou: 0.64, feature_importance: { rain: 1 } })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sources).toEqual(["manifest"]);
    expect(body.data_date).toBeNull();
    expect(body.metrics).toEqual({ iou: 0.64, feature_importance: { rain: 1 } });
  });

  test("missing asset and no manifest data returns 404", async () => {
    expect((await routeWithFake({ error: "Image asset does not exist" })).status).toBe(404);
  });

  test("missing asset is rescued by manifest data", async () => {
    const response = await routeWithFake(
      { error: "Image asset does not exist" },
      manifestOf({ f1: 0.7 })
    );
    expect(response.status).toBe(200);
    expect((await response.json()).sources).toEqual(["manifest"]);
  });

  test("compute failure with no manifest data returns 502", async () => {
    expect((await routeWithFake({ error: "quota exceeded" })).status).toBe(502);
  });

  test("manifest read failure plus gee failure returns 503", async () => {
    const response = await routeWithFake({ hang: true }, failingManifest);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("metrics unavailable");
  });

  test("200 merges manifest base with gee overlay scalars", async () => {
    const response = await routeWithFake(
      {
        props: {
          iou: 0.9, // overrides manifest
          warned_24h_pct: 55,
          feature_importance: { ignored: 1 }, // non-scalar never taken from asset
        },
      },
      manifestOf({
        event: "rs-2024-05",
        iou: 0.64,
        f1: 0.78,
        lead_time_iqr_h: [30, 60],
        feature_importance: { imerg: 0.5 },
      } as MetricsV4)
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      case: "rs-2024-05",
      canonical: "rs_2024",
      ...DATES,
      sources: ["manifest", "gee"],
      metrics: {
        event: "rs-2024-05",
        iou: 0.9,
        f1: 0.78,
        lead_time_iqr_h: [30, 60],
        feature_importance: { imerg: 0.5 },
        warned_24h_pct: 55,
      },
    });
  });

  test("200 overlay-only echoes dates and passes numeric metrics verbatim", async () => {
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
      warned_24h_pct: 40,
      never_critical_pct: 5,
      n_points: 120,
      event_lead_h: 30,
      critical_area_km2: 12.5,
      critical_area_with_damage_pct: 61,
      anchor_precision: "mixed",
      official_warning_delta_h: 18.5,
      flood_source: "nisar",
    };
    const response = await routeWithFake({ props: {
      ...metrics,
      people_critical: 123,
      lead_time_iqr_h: [1, 2],
      lead_time_hist: [0, 4],
      lead_time_assumptions: { x: 1 },
      damage_anchor: { x: 1 },
      rf_auc: 0.9,
      "system:index": "metrics",
    } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      case: "rs-2024-05", canonical: "rs_2024", ...DATES, sources: ["gee"], metrics,
    });
  });

  test("lead-time overlay keys reject junk values", async () => {
    const response = await routeWithFake({
      props: {
        warned_24h_pct: Number.NaN,
        anchor_precision: "minute",
        official_warning_delta_h: "soon",
        n_points: "many",
      },
    });
    expect(response.status).toBe(200);
    expect((await response.json()).metrics).toEqual({});
  });

  test("anchor_precision enum values and null official_warning_delta_h pass through", async () => {
    for (const anchor_precision of ["hour", "date", "mixed"] as const) {
      clearMetricsCache();
      const fake = fakeEe({ props: { anchor_precision, official_warning_delta_h: null } });
      const result = await createMetricsService(fake.ee, {
        readManifest: noManifest,
      }).getMetrics(QUERY);
      expect(result.metrics).toEqual({ anchor_precision, official_warning_delta_h: null });
    }
  });

  test("manifest-only result carries fragment keys and null dates", async () => {
    const manifest: MetricsV4 = {
      event: "rs-2024-05",
      iou: 0.64,
      rf_auc: 0.88,
      feature_importance: { imerg_p95_mm: 0.46 },
      forecast_source: "perfect-forecast",
    };
    const result = await createMetricsService(undefined, {
      readManifest: manifestOf(manifest),
    }).getMetrics(QUERY);
    expect(result).toEqual({
      case: "rs-2024-05",
      canonical: "rs_2024",
      data_date: null,
      updated_at: null,
      sources: ["manifest"],
      metrics: manifest,
    });
  });

  test("absent metrics are omitted and null flood_source is retained", async () => {
    const response = await routeWithFake({ props: { iou: 0, flood_source: null } });
    expect(await response.json()).toEqual({
      case: "rs-2024-05", canonical: "rs_2024", ...DATES, sources: ["gee"],
      metrics: { iou: 0, flood_source: null },
    });
  });

  test("fallback credential env works without a real key", async () => {
    const fake = fakeEe();
    setMetricsServiceForTest(createMetricsService(fake.ee, { readManifest: noManifest }));
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
    const service = createMetricsService(fake.ee, { assetRoot: "root", readManifest: noManifest });
    expect((await service.getMetrics(QUERY)).case).toBe("rs-2024-05");
    expect((await service.getMetrics({ caseId: "rs_2024" })).case).toBe("rs_2024");
    expect(fake.assets).toEqual(["root/rs_2024/metrics"]);
    expect(fake.reads()).toBe(1);
  });

  test("success expires after ten minutes", async () => {
    let now = 0;
    const fake = fakeEe();
    const service = createMetricsService(fake.ee, { now: () => now, readManifest: noManifest });
    await service.getMetrics(QUERY);
    now = 599_999;
    await service.getMetrics(QUERY);
    expect(fake.reads()).toBe(1);
    now = 600_000;
    await service.getMetrics(QUERY);
    expect(fake.reads()).toBe(2);
  });

  test("404 negative cache preserves class and expires after thirty seconds", async () => {
    let now = 0;
    const fake = fakeEe({ error: "asset not found" });
    const service = createMetricsService(fake.ee, {
      now: () => now,
      timeoutMs: 5,
      readManifest: noManifest,
    });
    const first = await service.getMetrics(QUERY).catch((error: unknown) => error);
    expect(first).toBeInstanceOf(MetricsNotFoundError);
    now = 29_999;
    expect(await service.getMetrics(QUERY).catch((error: unknown) => error)).toBe(first);
    expect(fake.reads()).toBe(1);
    now = 30_000;
    expect(await service.getMetrics(QUERY).catch((error: unknown) => error)).toBeInstanceOf(MetricsNotFoundError);
    expect(fake.reads()).toBe(2);
  });

  test("both-dead is MetricsUnavailableError, negative cached for thirty seconds", async () => {
    let now = 0;
    const fake = fakeEe({ hang: true });
    const service = createMetricsService(fake.ee, {
      now: () => now,
      timeoutMs: 5,
      readManifest: failingManifest,
    });
    const first = await service.getMetrics(QUERY).catch((error: unknown) => error);
    expect(first).toBeInstanceOf(MetricsUnavailableError);
    now = 29_999;
    expect(await service.getMetrics(QUERY).catch((error: unknown) => error)).toBe(first);
    expect(fake.reads()).toBe(1);
    now = 30_000;
    expect(await service.getMetrics(QUERY).catch((error: unknown) => error)).toBeInstanceOf(MetricsUnavailableError);
    expect(fake.reads()).toBe(2);
  });

  test("gee timeout with only an absent manifest is not negative cached", async () => {
    const fake = fakeEe({ hang: true });
    const service = createMetricsService(fake.ee, { timeoutMs: 5, readManifest: noManifest });
    const error = await service.getMetrics(QUERY).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetricsTimeoutError);
    await service.getMetrics(QUERY).catch(() => {});
    expect(fake.reads()).toBe(2);
  });

  test("502 failures are not cached", async () => {
    const fake = fakeEe({ error: "quota exceeded" });
    const service = createMetricsService(fake.ee, { readManifest: noManifest });
    await service.getMetrics(QUERY).catch(() => {});
    await service.getMetrics(QUERY).catch(() => {});
    expect(fake.reads()).toBe(2);
  });

  test("synchronous Image errors map to not found", async () => {
    const fake = fakeEe({ throws: true });
    const error = await createMetricsService(fake.ee, { readManifest: noManifest })
      .getMetrics(QUERY)
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(MetricsNotFoundError);
  });

  test("GEE_TIMEOUT_MS config bounds getInfo", async () => {
    const fake = fakeEe({ hang: true });
    await withEnv({ GEE_TIMEOUT_MS: "5" }, async () => {
      const error = await createMetricsService(fake.ee, { readManifest: noManifest })
        .getMetrics(QUERY)
        .catch((error: unknown) => error);
      expect(error).toBeInstanceOf(MetricsTimeoutError);
      expect((error as Error).message).toContain("5ms");
    });
  });

  test("opera and observed flood_source values pass through", async () => {
    for (const flood_source of ["opera", "observed"] as const) {
      clearMetricsCache();
      const fake = fakeEe({ props: { flood_source } });
      expect(
        (await createMetricsService(fake.ee, { readManifest: noManifest }).getMetrics(QUERY)).metrics
      ).toEqual({ flood_source });
    }
  });

  test("no-credential entry still serves manifest data", async () => {
    const result = await withEnv(
      { GCP_SA_KEY: undefined, GEE_SERVICE_ACCOUNT_KEY: undefined },
      () => getMetrics(QUERY)
    );
    expect(result.sources).toEqual(["manifest"]);
    expect(result.data_date).toBeNull();
    expect(result.metrics.event).toBe("rs-2024-05");
  });

  test("dead gee init still serves manifest data", async () => {
    setMetricsEeFactoryForTest(() => Promise.reject(new Error("auth boom")));
    const result = await withEnv({ GCP_SA_KEY: "test-key" }, () => getMetrics(QUERY));
    expect(result.sources).toEqual(["manifest"]);
    expect(result.data_date).toBeNull();
    expect(result.metrics.event).toBe("rs-2024-05");
  });

  test("dead gee init surfaces as service error when the manifest is absent", async () => {
    setMetricsEeFactoryForTest(() => Promise.reject(new Error("auth boom")));
    const error = await withEnv({ GCP_SA_KEY: "test-key" }, () =>
      getMetrics({ caseId: "nope-9999" }).catch((e: unknown) => e)
    );
    expect(error).toBeInstanceOf(MetricsServiceError);
    expect((error as Error).message).toContain("gee init failed");
  });

  test("dead gee init timeout surfaces as timeout when the manifest is absent", async () => {
    setMetricsEeFactoryForTest(() =>
      Promise.reject(new TileServiceError("timeout after 5ms waiting for gee init"))
    );
    const error = await withEnv({ GCP_SA_KEY: "test-key" }, () =>
      getMetrics({ caseId: "nope-9999" }).catch((e: unknown) => e)
    );
    expect(error).toBeInstanceOf(MetricsTimeoutError);
  });
});
