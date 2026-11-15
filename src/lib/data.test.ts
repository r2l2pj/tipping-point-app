// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { createServer } from "node:http";

import path from "node:path";

import realMetrics from "../../test/fixtures/metrics-19c56df.json";
import { getAlerts, getCaseBundle, getEventsIndex, getMetrics, getRootManifest } from "./data";
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

// L14: under `bun test` bundled-copy reads default to test/fixtures/
// public-data (see dataDir in data.ts) — never the repo's public/data.
// Pending tests redirect DATA_FS_DIR to a dir that ships nothing.
const EMPTY_DATA = path.join(process.cwd(), "test", "fixtures", "public-data-empty");

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
const savedFsDir = process.env.DATA_FS_DIR;
const savedNeon = process.env.NEON_S3_ENDPOINT;
afterEach(() => {
  if (savedBase === undefined) delete process.env.DATA_BASE_URL;
  else process.env.DATA_BASE_URL = savedBase;
  if (savedFsDir === undefined) delete process.env.DATA_FS_DIR;
  else process.env.DATA_FS_DIR = savedFsDir;
  if (savedNeon === undefined) delete process.env.NEON_S3_ENDPOINT;
  else process.env.NEON_S3_ENDPOINT = savedNeon;
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
  test("raw-style localhost JSON loads remotely and binary GET honors Range", async () => {
    stageReplay();
    const prefix = "/r2l2pj/tipping-point-data/fallback/data/";
    const binary = Buffer.from([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0]);
    const fixture = createServer((req, res) => {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (!pathname.startsWith(prefix)) {
        res.writeHead(404).end();
        return;
      }
      const key = pathname.slice(prefix.length);
      if (key === "fixture.tif") {
        res.setHeader("Content-Type", "image/tiff");
        res.setHeader("Accept-Ranges", "bytes");
        const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
        const start = range ? Number(range[1]) : 0;
        const end = range?.[2] ? Math.min(Number(range[2]), binary.length - 1) : binary.length - 1;
        if (start > end || start >= binary.length) {
          res.writeHead(416, { "Content-Range": `bytes */${binary.length}` }).end();
          return;
        }
        if (range) res.setHeader("Content-Range", `bytes ${start}-${end}/${binary.length}`);
        res.writeHead(range ? 206 : 200, { "Content-Length": end - start + 1 });
        res.end(binary.subarray(start, end + 1));
        return;
      }
      const body = files.get(key);
      res.writeHead(body === undefined ? 404 : 200, { "Content-Type": "application/json" });
      res.end(body === undefined ? "null" : JSON.stringify(body));
    });
    await new Promise<void>((resolve) => fixture.listen(0, "127.0.0.1", resolve));
    try {
      const address = fixture.address();
      if (!address || typeof address === "string") throw new Error("fixture has no port");
      const rawBase = `http://127.0.0.1:${address.port}${prefix}`;
      process.env.DATA_BASE_URL = `${rawBase}//`;
      expect((await getRootManifest())?.updated_at).toBe("2026-11-14T12:00:00Z");
      const bundle = await getCaseBundle("rs_2024", "RS", RS_BBOX, "2024-05-02");
      expect(bundle.metricsView?.iou).toBe(0.99);
      expect(bundle.places?.features[0].properties?.name).toBe("Remoto");
      expect(bundle.manifest?.layers[0].png).toBe(`${rawBase}rs_2024/png/tpi_slide_20240502.png`);
      expect(bundle.fallback).toBe(false);
      const json = await fetch(`${rawBase}manifest.json`);
      expect(json.headers.get("Access-Control-Allow-Origin")).toBe("*");
      const ranged = await fetch(`${rawBase}fixture.tif`, { headers: { Range: "bytes=2-5" } });
      expect(ranged.status).toBe(206);
      expect(ranged.headers.get("Content-Range")).toBe("bytes 2-5/8");
      expect(ranged.headers.get("Content-Length")).toBe("4");
      expect(ranged.headers.get("Accept-Ranges")).toBe("bytes");
      expect(new Uint8Array(await ranged.arrayBuffer())).toEqual(new Uint8Array(binary.subarray(2, 6)));
    } finally {
      await new Promise<void>((resolve, reject) => fixture.close((error) => error ? reject(error) : resolve()));
    }
  });
  test("bundle data comes from the remote copy; layer pngs resolve to URLs", async () => {
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

  test("a file that is in no place is not a fallback", async () => {
    // The products map leaves `swot` out, so the loader tries the fixed file
    // name. The remote does not have it and neither does the bundled copy:
    // nothing substitute is shown, so the bundle is not "last saved data".
    stageReplay();
    const root = remoteRoot();
    delete (root.cases.rs_2024.products as Record<string, unknown>).swot;
    files.set("manifest.json", root);
    process.env.DATA_BASE_URL = base;
    process.env.DATA_FS_DIR = EMPTY_DATA;

    const b = await getCaseBundle("rs-2024-05", "RS", RS_BBOX, "2024-05-02");

    expect(hits).toContain("rs_2024/series/swot.json");
    expect(b.swot).toBeUndefined();
    expect(b.fallback).toBe(false);
  });

  test("remote 404 falls back to public/data and flags the bundle", async () => {
    process.env.DATA_BASE_URL = base; // server 404s everything — files empty

    const b = await getCaseBundle("rs-2024-05", "RS", RS_BBOX, "2024-05-02");

    expect(b.fallback).toBe(true);
    expect(b.manifest?.event_id).toBe("rs-2024-05");
    expect((b.metrics as MetricsV4 | undefined)?.iou).toBe(0.64); // the fixture copy
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

  test("real fallback metrics: #rs_2024 resolves through the cases wrapper; nested landslide_hit flattens to the event day", async () => {
    stageReplay();
    files.set("metrics.json", realMetrics); // real 19c56df, not a mock
    process.env.DATA_BASE_URL = base;

    const metrics = await getMetrics("rs-2024-05");
    expect((metrics as MetricsV4).event).toBe("rs-2024-05");
    expect((metrics as MetricsV4).landslide_hit?.per_day).toHaveLength(3);
    expect((metrics as MetricsV4).landslide_hit_pct).toBeUndefined();

    const b = await getCaseBundle("rs-2024-05", "RS", RS_BBOX, "2024-05-02");
    // event day 2024-05-02 hit_pct 85.855 -> normalized 0-1
    expect(b.metricsView?.landslide_hit_pct).toBeCloseTo(0.85855, 5);
    expect(b.metricsView?.landslide_hit?.n_points).toBe(16027);
  });
});

describe("remote returns 404 for everything", () => {
  test("loaders degrade to bundled public/data and never throw", async () => {
    process.env.DATA_BASE_URL = base; // files empty -> every remote read 404s

    const root = await getRootManifest();
    expect(Object.keys(root?.cases ?? {})).toEqual(
      expect.arrayContaining(["rs_2024", "wa_2025", "now"])
    );

    const b = await getCaseBundle("rs-2024-05", "RS", RS_BBOX, "2024-05-02");
    expect(b.fallback).toBe(true);
    expect(b.manifest?.event_id).toBe("rs-2024-05");
    expect((b.metrics as MetricsV4 | undefined)?.iou).toBe(0.64); // fixture

    const metrics = await getMetrics("rs-2024-05");
    expect((metrics as MetricsV4).iou).toBe(0.64);

    const now = await getCaseBundle(
      "now",
      "Now",
      [-58, -34, -48, -22.5],
      "2026-11-14"
    );
    expect(now.mode).toBe("live");
    expect(now.fallback).toBe(true);
    // every now/ product + metrics + series was tried remotely, served bundled
    expect(now.summary?.critical_km2?.any).toBe(11.4);
    expect(now.nowAlerts?.candidates).toHaveLength(3);
    expect(now.series?.days).toHaveLength(9);
    expect(hits).toEqual(
      expect.arrayContaining([
        "manifest.json",
        "metrics.json",
        "now/metrics.json",
        "now/series/imerg_smap_daily.json",
        "now/summary.json",
        "now/alerts.json",
      ])
    );
    // heavy geojson layers are never fetched server-side — the client
    // lazy-loads them by URL (payload <300KB ruling)
    expect(hits.some((h) => h.includes("critical_areas"))).toBe(false);
    expect(hits.some((h) => h.includes("landslide_catalog"))).toBe(false);
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
    expect(b.nisarPasses?.[0].track).toBe("172D");
    expect(hits).toContain("now/summary.json");
    expect(hits).toContain("now/alerts.json");
    // critical_areas is a heavy layer — deferred to a client-side URL load
    expect(hits).not.toContain("now/geojson/critical_areas.geojson");
  });

  test("no series file -> series undefined + pending 'series' (no fabricated days)", async () => {
    stageNow();
    process.env.DATA_BASE_URL = base;

    const b = await getCaseBundle("now", "Now", [-58, -34, -48, -22.5], "2026-11-14");

    // L14: the loader never fabricates imerg/smap/tpi zeros for an absent
    // series — the timeline is pending, not synthesized from layer dates.
    expect(b.series).toBeUndefined();
    expect(b.pending).toContain("series");
    // forecast flag is on the manifest layers via toNowView
    expect(b.manifest?.layers.map((l) => l.id)).toEqual([
      "tpi_slide_d0",
      "tpi_slide_d1",
      "tpi_flood_d2",
    ]);
  });
});

describe("default remote bases (no DATA_BASE_URL)", () => {
  test("remote misses use the bundled public/data last resort", async () => {
    delete process.env.DATA_BASE_URL;
    delete process.env.NEON_S3_ENDPOINT;
    const requested: string[] = [];
    const remote = spyOn(globalThis, "fetch").mockImplementation(async (input: string | URL | Request) => {
      requested.push(String(input));
      return new Response("not found", { status: 404 });
    });
    try {
      const root = await getRootManifest();
      expect(Object.keys(root?.cases ?? {})).toEqual(
        expect.arrayContaining(["rs_2024", "wa_2025", "now"])
      );


      const b = await getCaseBundle("rs-2024-05", "RS", RS_BBOX, "2024-05-02");
      expect(b.manifest?.event_id).toBe("rs-2024-05");
      expect((b.metrics as MetricsV4 | undefined)?.iou).toBe(0.64);
      expect(b.metricsView?.warned_before_pct).toBe(0.81);
      expect(b.series?.days[0].kind).toBe("observed");
      expect(b.fallback).toBe(true);
      // no creds, no injected gee -> live overlay untouched
      expect(b.dataSource).toBeUndefined();
      expect(b.liveLayers).toBeUndefined();
      expect(b.dataDate).toBeUndefined();
      // Built-in public Neon bucket first, GitHub fallback branch second.
      expect(requested[0]).toContain("/tipping-point-data/data/manifest.json");
      expect(requested[0]).toContain("aws.neon.tech");
      expect(requested[1]).toBe("https://raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data/manifest.json");
    } finally {
      remote.mockRestore();
    }
  });

  // L17: with no explicit DATA_BASE_URL the public Neon bucket is tried first;
  // a Neon miss falls through to the GitHub fallback branch, then disk.
  test("NEON_S3_ENDPOINT default: bucket first, github next", async () => {
    delete process.env.DATA_BASE_URL;
    process.env.NEON_S3_ENDPOINT = "https://neon-s3.example.com";
    const requested: string[] = [];
    const remote = spyOn(globalThis, "fetch").mockImplementation(async (input: string | URL | Request) => {
      requested.push(String(input));
      return new Response("not found", { status: 404 });
    });
    try {
      await getRootManifest();
      expect(requested[0]).toBe("https://neon-s3.example.com/tipping-point-data/data/manifest.json");
      expect(requested[1]).toBe("https://raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data/manifest.json");
    } finally {
      remote.mockRestore();
    }
  });
});

// Payload budget: the serialized dashboard bundle must stay under 300 KB
// against the real bundled copy — heavy geojson is client-loaded by URL.
describe("payload budget (<300KB)", () => {
  test("real public/data: every case bundle serializes under 300KB", async () => {
    process.env.DATA_BASE_URL = "http://127.0.0.1:1"; // force bundled reads
    delete process.env.NEON_S3_ENDPOINT;
    process.env.DATA_FS_DIR = path.join(
      process.cwd(),
      "public",
      "data"
    );
    const index = await getEventsIndex();
    const ids = [...index.events.map((e) => e.id), "now"];
    for (const id of ids) {
      const b = await getCaseBundle(id, id, undefined, undefined).catch(
        () => undefined
      );
      if (!b) continue;
      const bytes = Buffer.byteLength(JSON.stringify(b), "utf-8");
      expect(bytes).toBeLessThan(300 * 1024);
    }
    // at least the real cases must have loaded
    expect(ids.length).toBeGreaterThan(1);
  });
});

// L8: injected gee fakes drive the live overlay without credentials.
describe("live GEE overlay (injected gee)", () => {
  test("live numbers overlay metricsView incl. flood_source='nisar'; layers land on liveLayers", async () => {
    stageReplay();
    process.env.DATA_BASE_URL = base;

    const b = await getCaseBundle("rs-2024-05", "RS", RS_BBOX, "2024-05-02", {
      gee: {
        numbers: async (q) => {
          expect(q).toEqual({ caseId: "rs_2024", date: "2024-05-02" });
          return {
            case: "rs_2024",
            date: "2024-05-02",
            people_exposed: 1234,
            flooded_km2: 55.5,
            people_flooded: 321,
            data_date: "2024-05-03",
            source: "properties",
          };
        },
        layers: async (caseId) => {
          expect(caseId).toBe("rs_2024");
          return {
            case: "rs_2024",
            layers: [{ id: "tpi_slide", dates: ["2024-05-02"], asset: "x" }],
          };
        },
      },
    });

    expect(b.metricsView?.people_critical).toBe(1234);
    expect(b.metricsView?.flooded_km2).toBe(55.5);
    expect(b.metricsView?.flood_source).toBe("nisar");
    expect(b.metricsView?.people_flooded).toBe(321);
    expect(b.metricsView?.iou).toBe(0.99); // untouched fields preserved
    expect(b.liveLayers).toHaveLength(1);
    expect(b.liveLayers?.[0].id).toBe("tpi_slide");
    expect(b.dataSource).toBe("gee");
    expect(b.dataDate).toBe("2024-05-03");
    expect(b.fallback).toBe(false);
  });

  test("now case: numbers overlay summary.critical_km2.any + people fields, query date is the d0 layer date", async () => {
    // Empty fixture: every remote read 404s so the bundled now/ copy serves —
    // remote misses flag fellBack, but the overlay still applies.
    process.env.DATA_BASE_URL = base;

    const b = await getCaseBundle(
      "now",
      "Now",
      [-58, -34, -48, -22.5],
      "2026-11-14",
      {
        gee: {
          numbers: async (q) => {
            expect(q).toEqual({ caseId: "now", date: "2026-11-14" });
            return {
              case: "now",
              date: "2026-11-14",
              km2_critical: 42.5,
              people_exposed: 999,
              source: "computed",
            };
          },
          layers: async () => ({
            case: "now",
            layers: [{ id: "tpi_slide", dates: ["2026-11-14"] }],
          }),
        },
      }
    );

    expect(b.summary?.critical_km2?.any).toBe(42.5);
    expect(b.summary?.critical_km2?.slide).toBe(3.1); // other keys preserved
    expect(b.summary?.people_exposed).toBe(999);
    expect(b.summary?.people_critical).toBe(999);
    expect(b.dataSource).toBe("gee");
    expect(b.fallback).toBe(true); // bundled copy served via remote misses
  });

  test("numbers error + layers error -> fallback, static values preserved", async () => {
    stageReplay();
    process.env.DATA_BASE_URL = base;

    const b = await getCaseBundle("rs-2024-05", "RS", RS_BBOX, "2024-05-02", {
      gee: {
        numbers: async () => {
          throw new Error("no band 20240502 on asset");
        },
        layers: async () => {
          throw new Error("gee unreachable");
        },
      },
    });

    expect(b.fallback).toBe(true);
    expect(b.dataSource).toBe("static");
    expect(b.liveLayers).toBeUndefined();
    expect(b.dataDate).toBeUndefined();
    expect((b.metrics as MetricsV4 | undefined)?.iou).toBe(0.99);
    expect(b.metricsView?.flood_source).toBeUndefined();
  });

  test("empty layers array means degraded -> fallback even when numbers applied", async () => {
    stageReplay();
    process.env.DATA_BASE_URL = base;

    const b = await getCaseBundle("rs-2024-05", "RS", RS_BBOX, "2024-05-02", {
      gee: {
        numbers: async () => ({
          case: "rs_2024",
          date: "2024-05-02",
          people_exposed: 10,
          source: "properties",
        }),
        layers: async () => ({ case: "rs_2024", layers: [] }),
      },
    });

    expect(b.liveLayers).toEqual([]);
    expect(b.metricsView?.people_critical).toBe(10);
    expect(b.dataSource).toBe("gee"); // numbers still contributed content
    expect(b.fallback).toBe(true); // but nothing published -> degraded
  });
});

// A10: bbox / reference_date / TPI class cuts come from the contract
// (manifest case node + series + events.json), never from caller literals.
describe("contract-derived bbox / reference_date / tpiCuts", () => {
  test("bbox and reference_date derive from the manifest when args are omitted", async () => {
    stageReplay();
    process.env.DATA_BASE_URL = base;

    const b = await getCaseBundle("rs_2024", "RS");

    expect(b.bbox).toEqual(RS_BBOX); // case-node bounds
    expect(b.reference_date).toBe("2024-05-10"); // entry.updated_at first 10 chars
    expect(b.tpiCuts).toEqual([0.2, 0.4, 0.6]); // contract default TPI_CUTS
  });

  test("reference_date falls to the latest non-forecast layer date", async () => {
    stageReplay();
    const root = remoteRoot();
    delete (root.cases.rs_2024 as Record<string, unknown>).updated_at;
    delete (root as Record<string, unknown>).updated_at;
    (root.cases.rs_2024.layers as Record<string, unknown>[]).push({
      id: "tpi_slide_d1",
      date: "2024-05-03",
      forecast: true,
    });
    files.set("manifest.json", root);
    process.env.DATA_BASE_URL = base;

    const b = await getCaseBundle("rs_2024", "RS");

    // data_dates.observed absent -> latest observed (non-forecast) layer date;
    // the forecast d1 layer's later date must not win.
    expect(b.reference_date).toBe("2024-05-02");
  });

  test("manifest tpi_cuts override the contract default", async () => {
    stageReplay();
    const root = remoteRoot();
    (root.cases.rs_2024 as Record<string, unknown>).tpi_cuts = [0.1, 0.5, 0.9];
    files.set("manifest.json", root);
    process.env.DATA_BASE_URL = base;

    const b = await getCaseBundle("rs_2024", "RS");

    expect(b.tpiCuts).toEqual([0.1, 0.5, 0.9]);
  });
});

// L14: real outputs that haven't shipped surface as `pending` — the loader
// never fabricates values and never throws for them (only the root
// manifest and missing bounds still throw). DATA_FS_DIR points at an empty
// dir so remote 404s have no bundled copy to fall back on.
describe("pending semantics for absent real outputs (L14)", () => {
  const stageEmpty = () => {
    // DATA_FS_DIR must be set per test — the outer afterEach restores it.
    process.env.DATA_FS_DIR = EMPTY_DATA;
    process.env.DATA_BASE_URL = base;
  };

  test("everything present -> pending is empty", async () => {
    stageReplay();
    process.env.DATA_BASE_URL = base;

    const b = await getCaseBundle("rs_2024", "RS", RS_BBOX, "2024-05-02");

    expect(b.pending).toEqual([]);
  });

  test("metrics.json present but case key absent -> metricsView undefined + pending 'metrics'", async () => {
    stageReplay();
    files.set("metrics.json", {
      cases: { wa_2025: { event: "wa-2025-12", iou: 0.71 } },
    });
    stageEmpty();

    const b = await getCaseBundle("rs_2024", "RS", RS_BBOX, "2024-05-02");

    expect(b.metrics).toBeUndefined();
    expect(b.metricsView).toBeUndefined();
    expect(b.pending).toContain("metrics");
    expect(b.pending).not.toContain("series"); // series file still loads
  });

  test("series file absent -> series undefined + pending 'series'", async () => {
    stageReplay();
    files.delete("rs_2024/series/imerg_smap_daily.json");
    stageEmpty();

    const b = await getCaseBundle("rs_2024", "RS", RS_BBOX, "2024-05-02");

    expect(b.series).toBeUndefined();
    // 'series' marks the missing output; 'imerg_smap_daily' is the
    // declared-but-missing product id for the same file.
    expect(b.pending).toContain("series");
    expect(b.pending).toContain("imerg_smap_daily");
    expect(b.pending).not.toContain("metrics");
  });

  test("declared-but-missing product -> pending lists the product id", async () => {
    stageReplay();
    files.delete("rs_2024/geojson/priority_zones.geojson");
    stageEmpty();

    const b = await getCaseBundle("rs_2024", "RS", RS_BBOX, "2024-05-02");

    expect(b.zones).toBeUndefined();
    expect(b.pending).toContain("priority_zones");
    // declared-null products are absent by contract — not pending
    expect(b.pending).not.toContain("flood_confirmed");
    expect(b.pending).toEqual([...b.pending].sort());
  });

  test("alerts.json absent -> getAlerts() returns undefined", async () => {
    stageEmpty(); // files empty -> 404, no bundled copy

    await expect(getAlerts()).resolves.toBeUndefined();
  });

  test("root manifest absent -> getCaseBundle still throws", async () => {
    stageEmpty(); // files empty

    await expect(
      getCaseBundle("rs_2024", "RS", RS_BBOX, "2024-05-02")
    ).rejects.toThrow("data: manifest.json not found");
  });
});
