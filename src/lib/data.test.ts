// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";

import { getCaseBundle, getMetrics, getRootManifest } from "./data";
import type { MetricsV4 } from "./contract";

// bun-types isn't installed — declare the Bun.serve surface the tests use.
declare const Bun: {
  serve(opts: {
    port: number;
    fetch(req: Request): Response | Promise<Response>;
  }): { port: number; stop(): void };
};

// Fixture bucket: files map -> HTTP. Tests stage `files` per case; every
// request path is recorded in `hits`.
const files = new Map<string, unknown>();
const hits: string[] = [];
let server: { port: number; stop(): void };
let base = "";

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const key = decodeURIComponent(new URL(req.url).pathname).replace(
        /^\/+/,
        ""
      );
      hits.push(key);
      const body = files.get(key);
      return body === undefined
        ? new Response("not found", { status: 404 })
        : Response.json(body);
    },
  });
  base = `http://127.0.0.1:${server.port}`;
});
afterAll(() => server.stop());

const savedBase = process.env.DATA_BASE_URL;
afterEach(() => {
  if (savedBase === undefined) delete process.env.DATA_BASE_URL;
  else process.env.DATA_BASE_URL = savedBase;
  files.clear();
  hits.length = 0;
});

const RS_BBOX: [number, number, number, number] = [-52.5, -30.5, -50.5, -29.0];

// Minimal L4 root manifest: canonical keys, canonical paths, metrics#frag.
const remoteRoot = (overrides: Record<string, unknown> = {}) => ({
  updated_at: "2026-11-14T12:00:00Z",
  cases: {
    rs_2024: {
      event_id: "rs-2024-05",
      mode: "replay",
      bounds: RS_BBOX,
      updated_at: "2024-05-10T12:00:00Z",
      forecast_source: "perfect-forecast",
      data_dates: { imerg: "2024-05-02", smap: "2024-04-30" },
      layers: [
        {
          id: "tpi_slide",
          date: "2024-05-02",
          png: "rs_2024/png/tpi_slide_20240502.png",
          cog: "rs_2024/cog/rs_2024_tpi_slide_20240502.tif",
          legend: ["Baixo", "Moderado", "Alto", "Crítico"],
          bounds: RS_BBOX,
        },
      ],
      metrics: "metrics.json#rs_2024",
      products: {
        places: "rs_2024/geojson/places.geojson",
        priority_zones: "rs_2024/geojson/priority_zones.geojson",
        permanent_water: "rs_2024/geojson/permanent_water.geojson",
        imerg_smap_daily: "rs_2024/series/imerg_smap_daily.json",
        flood_confirmed: null,
        landslide_candidates: null,
        municipal_boundaries: null,
        landslide_catalog: null,
        swot: null,
      },
      _null_reasons: { flood_confirmed: "no NISAR coverage" },
    },
    ...overrides,
  },
});

const stageReplay = () => {
  files.set("manifest.json", remoteRoot());
  files.set("metrics.json", {
    cases: {
      rs_2024: { event: "rs-2024-05", iou: 0.99, f1: 0.88, cloud_pct: 42 },
      wa_2025: { event: "wa-2025-12", iou: 0.71 },
    },
  });
  files.set("rs_2024/series/imerg_smap_daily.json", {
    event: "rs-2024-05",
    reference_date: "2024-05-02",
    days: [
      { date: "2024-05-02", offset: 0, kind: "observed", imerg_mm: 47.1, smap: 0.95, tpi: 0.86 },
    ],
  });
  files.set("rs_2024/geojson/places.geojson", {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { name: "Remoto" }, geometry: { type: "Point", coordinates: [-51.0, -29.9] } },
    ],
  });
  files.set("rs_2024/geojson/priority_zones.geojson", { type: "FeatureCollection", features: [] });
  files.set("rs_2024/geojson/permanent_water.geojson", { type: "FeatureCollection", features: [] });
};

const NOW_NODE = {
  schema: "tipping-point/now@2",
  mode: "live",
  updated_at: "2026-11-14T12:00:00Z",
  bounds: [-58.0, -34.0, -48.0, -22.5],
  forecast_source: "geos-fp",
  data_dates: { imerg: "2026-11-14T08:00:00Z", smap: "2026-11-11" },
  layers: [
    { id: "tpi_slide_d0", date: "2026-11-14", png: "png/tpi_slide_d0.png", forecast: false, bounds: [-58, -34, -48, -22.5] },
    { id: "tpi_slide_d1", date: "2026-11-15", png: "png/tpi_slide_d1.png", forecast: true, bounds: [-58, -34, -48, -22.5] },
    { id: "tpi_flood_d2", date: "2026-11-16", png: "png/tpi_flood_d2.png", forecast: true, bounds: [-58, -34, -48, -22.5] },
  ],
  products: {
    critical_areas: "geojson/critical_areas.geojson",
    summary: "summary.json",
    alerts: "alerts.json",
    imerg_smap_daily: null,
  },
  nisar_passes: [{ date: "2026-11-09", track: "172D" }],
};

describe("remote-first reads (DATA_BASE_URL)", () => {
  test("bundle data comes from the bucket; layer pngs resolve to URLs", async () => {
    stageReplay();
    process.env.DATA_BASE_URL = base;

    const b = await getCaseBundle("rs-2024-05", "RS", RS_BBOX, "2024-05-02");

    expect(b.manifest?.event_id).toBe("rs-2024-05");
    expect((b.metrics as MetricsV4 | undefined)?.iou).toBe(0.99); // sentinel — the fs mock says 0.64
    expect(b.metricsView?.cloud_pct).toBe(0.42);
    expect(b.places?.features[0].properties?.name).toBe("Remoto");
    expect(b.manifest?.layers[0].png).toBe(
      `${base}/rs_2024/png/tpi_slide_20240502.png`
    );
    expect(b.fallback).toBe(false);
    // null products are absent — never fetched, never read from disk
    expect(b.flood).toBeUndefined();
    expect(b.catalog).toBeUndefined();
    expect(hits).not.toContain("rs_2024/geojson/flood_confirmed.geojson");
  });

  test("remote 404 falls back to public/data and flags the bundle", async () => {
    process.env.DATA_BASE_URL = base; // server 404s everything — files empty

    const b = await getCaseBundle("rs-2024-05", "RS", RS_BBOX, "2024-05-02");

    expect(b.fallback).toBe(true);
    expect(b.manifest?.event_id).toBe("rs-2024-05");
    expect((b.metrics as MetricsV4 | undefined)?.iou).toBe(0.64); // the bundled mock
    expect(hits).toContain("manifest.json");
  });

  test("connection refused falls back to public/data", async () => {
    process.env.DATA_BASE_URL = "http://127.0.0.1:1";

    const b = await getCaseBundle("wa-2025-12", "WA", [-122.6, 47, -121.5, 48.5], "2025-12-12");

    expect(b.fallback).toBe(true);
    expect((b.metrics as MetricsV4 | undefined)?.iou).toBe(0.71);
    expect(b.series?.days.length).toBeGreaterThan(0);
  });

  test("products-map paths resolve relative to the data root", async () => {
    stageReplay();
    const root = remoteRoot();
    (root.cases.rs_2024.products as Record<string, unknown>).places =
      "rs_2024/custom/places.geojson";
    files.set("manifest.json", root);
    files.set("rs_2024/custom/places.geojson", {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { name: "Custom" }, geometry: { type: "Point", coordinates: [0, 0] } },
      ],
    });
    files.delete("rs_2024/geojson/places.geojson");
    process.env.DATA_BASE_URL = base;

    const b = await getCaseBundle("rs_2024", "RS", RS_BBOX, "2024-05-02");

    expect(hits).toContain("rs_2024/custom/places.geojson");
    expect(hits).not.toContain("rs_2024/geojson/places.geojson");
    expect(b.places?.features[0].properties?.name).toBe("Custom");
  });

  test("metrics#fragment indexes the root metrics.json by case key", async () => {
    stageReplay();
    process.env.DATA_BASE_URL = base;

    const metrics = await getMetrics("rs-2024-05");
    expect((metrics as MetricsV4).iou).toBe(0.99);
    expect(hits).toContain("metrics.json");
    // and via the bundle
    const b = await getCaseBundle("rs-2024-05", "RS", RS_BBOX, "2024-05-02");
    expect((b.metrics as MetricsV4 | undefined)?.f1).toBe(0.88);
  });
});

describe("now@2 bundle", () => {
  const stageNow = () => {
    files.set("manifest.json", remoteRoot({ now: NOW_NODE }));
    files.set("now/summary.json", {
      generated_at: "2026-11-14T12:00:00Z",
      critical_km2: { slide: 3.1, flood: 9.7, any: 11.4 },
      people_critical: 5200,
      people_exposed: 5200,
      forecast_source: "geos-fp",
    });
    files.set("now/alerts.json", {
      generated_at: "2026-11-14T12:00:00Z",
      quiet_hours: false,
      candidates: [
        { class: 3, label: "Crítico", centroid: [-51.6, -29.1], pixels: 42, hold: false },
        { class: 2, label: "Alto", centroid: [-49.4, -27.0], pixels: 18, hold: true },
      ],
    });
    files.set("now/geojson/critical_areas.geojson", {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { class: 3 }, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
      ],
    });
  };

  test("summary/alerts/critical_areas load via products paths", async () => {
    stageNow();
    process.env.DATA_BASE_URL = base;

    const b = await getCaseBundle("now", "Now", [-58, -34, -48, -22.5], "2026-11-14");

    expect(b.mode).toBe("live");
    expect(b.summary?.critical_km2?.any).toBe(11.4);
    expect(b.nowAlerts?.candidates).toHaveLength(2);
    expect(b.nowAlerts?.candidates?.[1].hold).toBe(true);
    expect(b.criticalAreas?.features).toHaveLength(1);
    expect(b.nisarPasses?.[0].track).toBe("172D");
    expect(hits).toContain("now/summary.json");
    expect(hits).toContain("now/alerts.json");
    expect(hits).toContain("now/geojson/critical_areas.geojson");
  });

  test("timeline days derive from layer dates + forecast flags (no series)", async () => {
    stageNow();
    process.env.DATA_BASE_URL = base;

    const b = await getCaseBundle("now", "Now", [-58, -34, -48, -22.5], "2026-11-14");

    expect(b.series?.days.map((d) => d.date)).toEqual([
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
    ]);
    expect(b.series?.days.map((d) => d.kind)).toEqual([
      "observed",
      "forecast",
      "forecast",
    ]);
    expect(b.series?.days[0].offset).toBe(0);
    expect(b.series?.days[2].offset).toBe(2);
    expect(b.series?.reference_date).toBe("2026-11-14");
    // forecast flag is on the manifest layers via toNowView
    expect(b.manifest?.layers.map((l) => l.id)).toEqual([
      "tpi_slide_d0",
      "tpi_slide_d1",
      "tpi_flood_d2",
    ]);
  });
});

describe("fs-only mode (no DATA_BASE_URL)", () => {
  test("bundles load from the bundled public/data copy", async () => {
    delete process.env.DATA_BASE_URL;

    const root = await getRootManifest();
    expect(Object.keys(root?.cases ?? {})).toEqual(
      expect.arrayContaining(["rs_2024", "wa_2025", "now"])
    );

    const b = await getCaseBundle("rs-2024-05", "RS", RS_BBOX, "2024-05-02");
    expect(b.manifest?.event_id).toBe("rs-2024-05");
    expect((b.metrics as MetricsV4 | undefined)?.iou).toBe(0.64);
    expect(b.metricsView?.warned_before_pct).toBe(0.81);
    expect(b.series?.days[0].kind).toBe("observed");
    expect(b.fallback).toBe(false);
  });
});
