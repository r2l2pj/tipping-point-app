// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { afterEach, describe, expect, test } from "bun:test";
import { globals, writeArrayBuffer } from "geotiff";

import type { DayPoint } from "./types";
import {
  assetUrl,
  capToggleQueue,
  featureCenters,
  horizonLabel,
  horizonWords,
  isLongRange,
  probHorizonsAvailable,
  probLayerTitle,
  fmtDate,
  fmtDataStamp,
  fmtDateTime,
  isForecastLayer,
  layerAvailable,
  manifestRaster,
  overlayPlan,
  probLayerNote,
  pointInPolygons,
  resolvePixelValues,
  toggleBudget,
} from "./layers";

describe("isForecastLayer", () => {
  test("_d[1-3] suffix with no flag is forecast", () => {
    expect(isForecastLayer({ id: "tpi_slide_d1" })).toBe(true);
    expect(isForecastLayer({ id: "tpi_flood_d2" })).toBe(true);
    expect(isForecastLayer({ id: "tpi_slide_d3" })).toBe(true);
  });

  test("explicit flag beats the _d suffix", () => {
    expect(isForecastLayer({ id: "tpi_slide_d2", forecast: false })).toBe(false);
    expect(isForecastLayer({ id: "tpi", forecast: true })).toBe(true);
    expect(isForecastLayer({ id: "tpi_slide_d0", forecast: true })).toBe(true);
  });

  test("observed layers without flag or suffix are not forecast", () => {
    expect(isForecastLayer({ id: "tpi_slide" })).toBe(false);
    expect(isForecastLayer({ id: "tpi_slide_d0" })).toBe(false);
    expect(isForecastLayer({ id: "tpi_slide_d4" })).toBe(false);
    expect(isForecastLayer({ id: "tpi_forecast" })).toBe(false);
    expect(isForecastLayer({})).toBe(false);
  });
});

describe("overlayPlan", () => {
  const OFF = {
    floodPolygons: false,
    landslideCandidates: false,
    catalogPoints: false,
    operaValidation: false,
    nightLights: false,
  };

  test("alert shows TPI only", () => {
    expect(overlayPlan("alert")).toEqual({ tpi: true, ...OFF, count: 0 });
  });

  test("radar adds flood polygons and landslide candidates", () => {
    expect(overlayPlan("radar")).toEqual({
      tpi: true,
      ...OFF,
      floodPolygons: true,
      landslideCandidates: true,
      count: 2,
    });
  });

  test("validation adds catalog points and the OPERA raster", () => {
    expect(overlayPlan("validation")).toEqual({
      tpi: true,
      ...OFF,
      catalogPoints: true,
      operaValidation: true,
      count: 2,
    });
  });

  test("impact adds the night-lights raster", () => {
    expect(overlayPlan("impact")).toEqual({
      tpi: true,
      ...OFF,
      nightLights: true,
      count: 1,
    });
  });

  test("no tab / unknown tab behaves like alert", () => {
    expect(overlayPlan(undefined)).toEqual({ tpi: true, ...OFF, count: 0 });
    expect(overlayPlan("bogus")).toEqual({ tpi: true, ...OFF, count: 0 });
  });

  // viz rule 5: plan overlays count toward the two-layer budget.
  test("counts drive the toggle budget", () => {
    expect(toggleBudget("alert")).toBe(2);
    expect(toggleBudget("radar")).toBe(0);
    expect(toggleBudget("validation")).toBe(0);
    expect(toggleBudget("impact")).toBe(1);
    expect(toggleBudget(undefined)).toBe(2);
  });
});

describe("layerAvailable", () => {
  const bundle = (ids: { id: string; png?: string; cog?: string }[]) => ({
    manifest: { layers: ids },
  });

  test("a toggle is available only with a real raster in the manifest", () => {
    expect(layerAvailable(bundle([{ id: "imerg_daily", png: "a.png" }]), "imerg")).toBe(true);
    expect(layerAvailable(bundle([{ id: "imerg_daily", cog: "a.tif" }]), "imerg")).toBe(true);
    expect(layerAvailable(bundle([{ id: "imerg_daily" }]), "imerg")).toBe(false);
    expect(layerAvailable(bundle([]), "imerg")).toBe(false);
    expect(layerAvailable(undefined, "imerg")).toBe(false);
    expect(layerAvailable({} , "imerg")).toBe(false);
  });

  test("id prefixes route to the right toggle", () => {
    const b = bundle([
      { id: "tpi_slide", png: "s.png" },
      { id: "smap_2026", cog: "s.tif" },
      { id: "nisar_change", png: "n.png" },
    ]);
    expect(layerAvailable(b, "tpiSlide")).toBe(true);
    expect(layerAvailable(b, "tpiFlood")).toBe(false);
    expect(layerAvailable(b, "smap")).toBe(true);
    expect(layerAvailable(b, "nisar")).toBe(true);
    expect(layerAvailable(b, "imerg")).toBe(false);
  });

  test("the nisar swipe pair does not count for the toggle", () => {
    const swipe = bundle([
      { id: "nisar_pre", png: "a.png" },
      { id: "nisar_post", png: "b.png" },
    ]);
    expect(layerAvailable(swipe, "nisar")).toBe(false);
  });

  test("L25 p_trigger frames back the probability toggle", () => {
    const b = bundle([
      { id: "p_trigger_24h", png: "p24.png", date: "2025-12-11" },
      { id: "p_trigger_72h", png: "p72.png", date: "2025-12-13" },
    ]);
    expect(layerAvailable(b, "pTrigger")).toBe(true);
    expect(layerAvailable(bundle([{ id: "p_trigger_24h" }]), "pTrigger")).toBe(false);
    expect(layerAvailable(bundle([{ id: "tpi_slide", png: "t.png" }]), "pTrigger")).toBe(false);
    // per-day resolution prefers the frame stamped with the selected date
    const day = manifestRaster(b.manifest.layers, "pTrigger", "2025-12-13");
    expect(day?.id).toBe("p_trigger_72h");
  });
});

describe("probLayerNote", () => {
  test("issued time + forecast source label", () => {
    expect(
      probLayerNote({ id: "p_trigger_24h", png: "p.png", issued_at: "2025-12-11T06:00:00Z" })
    ).toContain("forecast: NOAA GFS");
    expect(
      probLayerNote({ id: "p_trigger_24h", png: "p.png", issued_at: "2025-12-11T06:00:00Z", forecast_source: "NOAA GFS" })
    ).toContain("issued Dec 11, 2025");
    expect(probLayerNote(undefined)).toBeUndefined();
  });
});

describe("capToggleQueue", () => {
  const all = () => true;

  test("live entries over budget evict oldest-first", () => {
    expect(capToggleQueue(["a", "b", "c"], 2, all)).toEqual({
      queue: ["b", "c"],
      off: ["a"],
    });
    expect(capToggleQueue(["a", "b"], 2, all)).toEqual({
      queue: ["a", "b"],
      off: [],
    });
  });

  // Reviewer finding: a dead entry (no raster in the bundle) must not
  // consume a budget slot nor evict a live layer.
  test("dead entries are dropped without evicting live ones", () => {
    const available = (k: string) => k !== "deadImerg";
    expect(
      capToggleQueue(["tpiSlide", "deadImerg"], 1, available)
    ).toEqual({ queue: ["tpiSlide"], off: ["deadImerg"] });
    expect(
      capToggleQueue(["deadA", "liveB", "deadC"], 1, (k) => k === "liveB")
    ).toEqual({ queue: ["liveB"], off: ["deadA", "deadC"] });
  });

  test("dead entries plus over-budget live ones both turn off", () => {
    const available = (k: string) => k !== "dead";
    expect(
      capToggleQueue(["dead", "a", "b", "c"], 1, available)
    ).toEqual({ queue: ["c"], off: ["dead", "a", "b"] });
  });
});

describe("no synthetic layer fills", () => {
  test("MapLayers never references the mock grids", async () => {
    const src = await Bun.file(
      new URL("../components/MapLayers.tsx", import.meta.url)
    ).text();
    expect(src).not.toContain("mockScalarGrid");
    expect(src).not.toContain("mockTpiGrid");
  });
});

const MUNI: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Polígono City" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
            [0, 0],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { nome: "Hole Town" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [10, 0],
            [16, 0],
            [16, 6],
            [10, 6],
            [10, 0],
          ],
          // hole — a point in here is NOT inside the feature
          [
            [12, 2],
            [14, 2],
            [14, 4],
            [12, 4],
            [12, 2],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { NM_MUN: "Multi City" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [20, 0],
              [24, 0],
              [24, 4],
              [20, 4],
              [20, 0],
            ],
          ],
          [
            [
              [30, 0],
              [34, 0],
              [34, 4],
              [30, 4],
              [30, 0],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [40, 0],
            [44, 0],
            [44, 4],
            [40, 4],
            [40, 0],
          ],
        ],
      },
    },
  ],
};

describe("pointInPolygons", () => {
  test("finds the name inside a Polygon", () => {
    expect(pointInPolygons(MUNI, 2, 2)).toBe("Polígono City");
  });

  test("finds the name inside any part of a MultiPolygon", () => {
    expect(pointInPolygons(MUNI, 22, 2)).toBe("Multi City");
    expect(pointInPolygons(MUNI, 32, 2)).toBe("Multi City");
  });

  test("falls back through nome and NM_MUN", () => {
    expect(pointInPolygons(MUNI, 11, 1)).toBe("Hole Town");
    expect(pointInPolygons(MUNI, 22, 2)).toBe("Multi City");
  });

  test("outside every polygon and inside a hole returns undefined", () => {
    expect(pointInPolygons(MUNI, 5, 5)).toBeUndefined();
    expect(pointInPolygons(MUNI, 13, 3)).toBeUndefined(); // in the hole
    expect(pointInPolygons(MUNI, 42, 2)).toBeUndefined(); // unnamed feature
    expect(pointInPolygons(undefined, 2, 2)).toBeUndefined();
  });
});

describe("assetUrl", () => {
  test("http(s) URLs pass through; gs:// has no special handling", () => {
    expect(assetUrl("wa_2025", "https://x/y.png")).toBe("https://x/y.png");
    expect(assetUrl("wa_2025", "gs://bucket/key.png")).toBe(
      "/data/wa_2025/gs://bucket/key.png"
    );
  });

  test("bucket-relative keys resolve under /data/<caseDir>", () => {
    expect(assetUrl("wa_2025", "cog/tpi.tif")).toBe("/data/wa_2025/cog/tpi.tif");
    expect(assetUrl("now", "png/tpi_slide_d0.png")).toBe(
      "/data/now/png/tpi_slide_d0.png"
    );
  });

  test("paths already carrying the case dir are not doubled", () => {
    expect(assetUrl("wa_2025", "wa_2025/png/a.png")).toBe(
      "/data/wa_2025/png/a.png"
    );
  });

  test("null/empty paths resolve to undefined", () => {
    expect(assetUrl("wa_2025", null)).toBeUndefined();
    expect(assetUrl("wa_2025", undefined)).toBeUndefined();
    expect(assetUrl("wa_2025", "")).toBeUndefined();
  });
});

describe("BRT date formatting", () => {
  test("fmtDateTime converts UTC to America/Sao_Paulo", () => {
    expect(fmtDateTime("2026-11-15T05:00:00Z")).toBe("02:00");
    expect(fmtDateTime("2026-11-15T02:59:00Z")).toBe("23:59");
  });

  test("fmtDate renders the long en-US date", () => {
    expect(fmtDate("2026-11-15T05:00:00Z")).toBe("Nov 15, 2026");
    expect(fmtDate("2024-05-02")).toBe("May 2, 2024"); // date-only stays on the day
  });

  test("missing input renders a dash", () => {
    expect(fmtDate(undefined)).toBe("—");
    expect(fmtDate(null)).toBe("—");
    expect(fmtDateTime(undefined)).toBe("—");
  });

  test("fmtDataStamp: a stamp with a time gets the Brasília clock + zone, date-only stays a date", () => {
    expect(fmtDataStamp("2026-11-15T05:00:00Z")).toBe("Nov 15, 02:00 BRT");
    expect(fmtDataStamp("2026-11-15T02:59:00Z")).toBe("Nov 14, 23:59 BRT");
    expect(fmtDataStamp("2026-11-15")).toBe("Nov 15, 2026");
    expect(fmtDataStamp("2026-11-15")).not.toContain("BRT");
    expect(fmtDataStamp(undefined)).toBe("—");
    expect(fmtDataStamp("not a date")).toBe("not a date"); // unparseable shown as authored
  });
});

// --- hermetic COG host -------------------------------------------------------

// Same trick as cog.test.ts: geotiff's writer needs GDAL_METADATA (42112)
// registered as ASCII to emit band descriptions.
(globals.fieldTagTypes as Record<number, string>)[42112] = "ASCII";

// bun-types isn't a dependency; declare the Bun.serve surface this test uses.
declare const Bun: {
  serve(options: {
    port?: number;
    fetch: (req: Request) => Response | Promise<Response>;
  }): { port: number; stop(closeActiveConnections?: boolean): void };
  file(path: string | URL): { text(): Promise<string> };
};

// 4x2 EPSG:4326 grid, 0.5° pixels, top-left at lon -50 / lat -29
// (lon in [-50,-48], lat in [-30,-29]). 2 bands = days 20260501/20260502;
// pixel p on band b reads 0.1*b + p/100.
const bandedTpi = () => {
  const px = 8;
  const data = new Float32Array(px * 2);
  for (let p = 0; p < px; p++)
    for (let b = 0; b < 2; b++) data[p * 2 + b] = 0.1 * b + p / 100;
  const gdal = `<GDALMetadata><Item name="DESCRIPTION" sample="0" role="description">20260501</Item><Item name="DESCRIPTION" sample="1" role="description">20260502</Item></GDALMetadata>`;
  return writeArrayBuffer(data, {
    width: 4,
    height: 2,
    ModelPixelScale: [0.5, 0.5, 0],
    ModelTiepoint: [0, 0, 0, -50, -29, 0],
    GeographicTypeGeoKey: 4326,
    ...{ GDAL_METADATA: gdal },
  });
};

const servers: { stop(): void }[] = [];
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  while (servers.length) servers.pop()!.stop();
});

function serveCog(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get("range") ?? "");
      if (m) {
        const start = Number(m[1]);
        const end = m[2]
          ? Math.min(Number(m[2]), bytes.length - 1)
          : bytes.length - 1;
        return new Response(bytes.slice(start, end + 1), {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
            "Accept-Ranges": "bytes",
          },
        });
      }
      return new Response(bytes, { headers: { "Accept-Ranges": "bytes" } });
    },
  });
  servers.push(server);
  return `http://localhost:${server.port}/cog.tif`;
}

describe("resolvePixelValues", () => {
  const day = { date: "2026-05-02" } as DayPoint;
  const values = {
    tpi_slide: 0.7, tpi_flood: 0.4, r: 0.8, s: 0.6,
    t_slide: 0.9, t_flood: 0.3,
  };

  for (const kind of ["slide", "flood", undefined] as const) {
    test(`GEE values are authoritative for ${kind ?? "unknown"} kind`, async () => {
      let requested = "";
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        requested = String(input);
        return Response.json({ values });
      }) as typeof fetch;
      expect(await resolvePixelValues(undefined, -49.75, -29.25, {
        caseId: "rs_2024", day, kind,
      })).toEqual({
        tpi: kind === "flood" ? 0.4 : 0.7,
        r: 0.8, s: 0.6, t: kind === "flood" ? 0.3 : 0.9,
        provenance: "gee",
      });
      const query = new URL(requested, "http://localhost").searchParams;
      expect(Object.fromEntries(query)).toEqual({
        case: "rs_2024", date: day.date, lat: "-29.25", lon: "-49.75",
      });
    });
  }

  test("GEE all-null values do not fall back to COG", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return Response.json({ values: Object.fromEntries(
        Object.keys(values).map((key) => [key, null])
      ) });
    }) as typeof fetch;
    expect(await resolvePixelValues(undefined, 0, 0, { caseId: "now", day }))
      .toEqual({ tpi: null, r: null, s: null, t: null, provenance: "gee" });
    expect(calls).toBe(1);
  });

  test("unknown kind and missing matching terrain use the other value", async () => {
    globalThis.fetch = (async () => Response.json({
      values: { ...values, tpi_slide: null, t_slide: null },
    })) as typeof fetch;
    for (const kind of [undefined, "slide"] as const) {
      const px = await resolvePixelValues(undefined, 0, 0, { caseId: "now", day, kind });
      expect(px?.tpi).toBe(kind === "slide" ? null : 0.4);
      expect(px?.t).toBe(0.3);
    }
  });

  for (const failure of [404, 503, "network", "json", "values"] as const) {
    test(`GEE ${failure} failure falls back to COG`, async () => {
      const url = serveCog(bandedTpi());
      let calls = 0;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).startsWith("/api/point?")) {
          calls++;
          if (failure === "network") throw new Error("offline");
          if (failure === "json") return new Response("not json");
          if (failure === "values") return Response.json({ values: { r: "bad" } });
          return new Response(null, { status: failure });
        }
        return originalFetch(input, init);
      }) as typeof fetch;
      const px = await resolvePixelValues(url, -49.75, -29.25, { caseId: "now", day });
      expect(px?.tpi).toBeCloseTo(0.1, 6);
      expect(px?.provenance).toBe("cog");
      expect(calls).toBe(1);
      expect(await resolvePixelValues(undefined, 0, 0, { caseId: "now", day })).toBeNull();
    });
  }

  test("without case or date the endpoint is skipped", async () => {
    const url = serveCog(bandedTpi());
    let calls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/point?")) {
        calls++;
        throw new Error("unexpected endpoint request");
      }
      return originalFetch(input, init);
    }) as typeof fetch;
    expect(await resolvePixelValues(undefined, 0, 0, { day })).toBeNull();
    expect(await resolvePixelValues(undefined, 0, 0, { caseId: "now" })).toBeNull();
    const px = await resolvePixelValues(url, -49.75, -29.25, { day });
    expect(px?.tpi).toBeCloseTo(0.1, 6);
    expect(px?.provenance).toBe("cog");
    expect(calls).toBe(0);
  });

  test("no cog URL resolves to null", async () => {
    await expect(resolvePixelValues(undefined, 0, 0)).resolves.toBeNull();
  });

  test("unreachable or relative COG URL degrades to null", async () => {
    await expect(
      resolvePixelValues("/data/x/cog.tif", -51, -30, { tpi: 0.7 })
    ).resolves.toBeNull();
    await expect(
      resolvePixelValues("http://127.0.0.1:1/nope.tif", -51, -30)
    ).resolves.toBeNull();
  });

  test("real COG read returns the banded TPI value; r/s/t merge over the estimate", async () => {
    const url = serveCog(bandedTpi());
    // lon -49.75 / lat -29.25 -> pixel (0,0) -> band 1 (2026-05-02) = 0.1
    const px = await resolvePixelValues(url, -49.75, -29.25, {
      day: { date: "2026-05-02", imerg_mm: 61, smap: 0.8, tpi: 0.7 } as DayPoint,
      rainP95Mm: 61,
      tpi: 0.7,
    });
    expect(px?.tpi).toBeCloseTo(0.1, 6);
    // no rstUrls published -> r/s/t fall back to the day-level estimate
    expect(px?.r).toBe(1); // 61mm / p95 61mm
    expect(px?.s).toBe(0.8);
    expect(px?.t).toBeCloseTo(0.42875, 4);
  });

  test("a TPI read that hits nothing returns null even with rst URLs", async () => {
    const px = await resolvePixelValues("http://127.0.0.1:1/nope.tif", -51, -30, {
      rstUrls: { r: "http://127.0.0.1:1/r.tif" },
    });
    expect(px).toBeNull();
  });
});

describe("zoneLabelPoint / rankedZonePoints", () => {
  const zone = (rank: number) => ({
    rank,
    name: `z${rank}`,
    tpi: 0.7,
    class: "Critical",
    hazard: "landslide",
    area_km2: 1,
    people: 10,
  });
  const square = (x: number, y: number, s: number) => [
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s],
    [x, y],
  ];
  const feat = (geometry: unknown, props: Record<string, unknown> = {}) =>
    ({ type: "Feature", geometry, properties: { ...zone(1), ...props } }) as never;

  test("Point uses its own coordinates", async () => {
    const { zoneLabelPoint } = await import("./layers");
    expect(
      zoneLabelPoint(feat({ type: "Point", coordinates: [-51.5, -30.2] }))
    ).toEqual([-51.5, -30.2]);
  });

  test("Polygon anchors at the centroid of its exterior ring", async () => {
    const { zoneLabelPoint } = await import("./layers");
    // 2x2 square at (-51, -30) -> centroid (-50, -29); inner ring ignored
    const geom = {
      type: "Polygon",
      coordinates: [square(-51, -30, 2), square(-51.5, -30.5, 1)],
    };
    const at = zoneLabelPoint(feat(geom));
    expect(at?.[0]).toBeCloseTo(-50, 6);
    expect(at?.[1]).toBeCloseTo(-29, 6);
  });

  test("MultiPolygon anchors at the LARGEST polygon's centroid", async () => {
    const { zoneLabelPoint } = await import("./layers");
    const geom = {
      type: "MultiPolygon",
      coordinates: [
        [square(0, 0, 1)], // area 1
        [square(-52, -31, 4)], // area 16 -> centroid (-50, -29)
      ],
    };
    const at = zoneLabelPoint(feat(geom));
    expect(at?.[0]).toBeCloseTo(-50, 6);
    expect(at?.[1]).toBeCloseTo(-29, 6);
  });

  test("label_lon/label_lat properties win over geometry", async () => {
    const { zoneLabelPoint } = await import("./layers");
    const at = zoneLabelPoint(
      feat(
        { type: "Polygon", coordinates: [square(-51, -30, 2)] },
        { label_lon: -49, label_lat: -28 }
      )
    );
    expect(at).toEqual([-49, -28]);
  });

  test("non-finite or missing geometry returns null (feature skipped)", async () => {
    const { zoneLabelPoint } = await import("./layers");
    expect(zoneLabelPoint(feat(null))).toBeNull();
    expect(
      zoneLabelPoint(feat({ type: "Point", coordinates: [NaN, NaN] }))
    ).toBeNull();
    expect(
      zoneLabelPoint(feat({ type: "Polygon", coordinates: [] }))
    ).toBeNull();
    expect(
      zoneLabelPoint(
        feat({ type: "Polygon", coordinates: [[[NaN, 0], [1, 0], [1, 1], [NaN, 0]]] })
      )
    ).toBeNull();
  });

  test("rankedZonePoints caps at max, sorts by rank, drops invalid", async () => {
    const { rankedZonePoints } = await import("./layers");
    const poly = (rank: number) =>
      ({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [square(-51, -30, 1)] },
        properties: zone(rank),
      }) as never;
    // 5000 polygon features like the real rs_2024 file, shuffled ranks
    const features = Array.from({ length: 5000 }, (_, i) => poly(5000 - i));
    features.push(feat(null, { rank: 0 })); // invalid, must be skipped
    const pts = rankedZonePoints(features as never);
    expect(pts.length).toBe(10);
    expect(pts[0].zone.rank).toBe(1);
    expect(pts[9].zone.rank).toBe(10);
    expect(pts.every((p) => Number.isFinite(p.at[0]) && Number.isFinite(p.at[1]))).toBe(true);
  });
});

describe("resilient sources: dropSource / safeImageUpdate / geoUrl / fetchGeo", () => {
  test("dropSource removes layer then source, swallows MapLibre throws", async () => {
    const { dropSource } = await import("./layers");
    const calls: string[] = [];
    const map = {
      getLayer: (id: string) => (id === "lyr" ? {} : undefined),
      removeLayer: (id: string) => {
        calls.push(`removeLayer:${id}`);
      },
      getSource: (id: string) => (id === "src" ? {} : undefined),
      removeSource: (id: string) => {
        calls.push(`removeSource:${id}`);
      },
    };
    dropSource(map, "src", "lyr");
    expect(calls).toEqual(["removeLayer:lyr", "removeSource:src"]);
    // missing layer + throwing teardown must not propagate
    const boom = {
      getLayer: () => ({}),
      removeLayer: () => {
        throw new Error("style gone");
      },
      getSource: () => ({}),
      removeSource: () => {
        throw new Error("style gone");
      },
    };
    expect(() => dropSource(boom, "src", "lyr")).not.toThrow();
  });

  test("safeImageUpdate returns false on a dead source instead of throwing", async () => {
    const { safeImageUpdate } = await import("./layers");
    const dead = {
      updateImage: () => {
        throw new TypeError(
          "Cannot read properties of undefined (reading 'getImage')"
        );
      },
    };
    expect(
      safeImageUpdate(dead, { url: "/data/x/a.png", coordinates: [] })
    ).toBe(false);
    const live = { updateImage: () => {} };
    expect(
      safeImageUpdate(live, { url: "/data/x/a.png", coordinates: [] })
    ).toBe(true);
    expect(
      safeImageUpdate(undefined, { url: "/data/x/a.png", coordinates: [] })
    ).toBe(false);
  });

  test("geoUrl: products map wins, null means absent, fixed name is fallback", async () => {
    const { geoUrl } = await import("./layers");
    const bundle = {
      products: {
        permanent_water: "rs_2024/geojson/custom_water.geojson",
        flood_confirmed: null,
      },
    };
    expect(
      geoUrl(bundle as never, "rs_2024", "permanent_water", "geojson/permanent_water.geojson")
    ).toBe("/data/rs_2024/geojson/custom_water.geojson");
    expect(
      geoUrl(bundle as never, "rs_2024", "flood_confirmed", "geojson/flood_confirmed.geojson")
    ).toBeUndefined();
    expect(
      geoUrl(bundle as never, "rs_2024", "landslide_catalog", "geojson/landslide_catalog.geojson")
    ).toBe("/data/rs_2024/geojson/landslide_catalog.geojson");
    expect(
      geoUrl(undefined, "rs_2024", "places", "geojson/places.geojson")
    ).toBe("/data/rs_2024/geojson/places.geojson");
  });

  test("fetchGeo resolves the FC, resolves null on 404, caches per URL", async () => {
    const { fetchGeo } = await import("./layers");
    const hits: string[] = [];
    const srv = Bun.serve({
      port: 0,
      fetch(req) {
        hits.push(new URL(req.url).pathname);
        return req.url.endsWith("/ok.geojson")
          ? Response.json({ type: "FeatureCollection", features: [] })
          : new Response("nope", { status: 404 });
      },
    });
    const ok = await fetchGeo(`http://localhost:${srv.port}/ok.geojson`);
    expect(ok?.type).toBe("FeatureCollection");
    expect(await fetchGeo(`http://localhost:${srv.port}/missing.geojson`)).toBeNull();
    // second call hits the cache — still one request
    await fetchGeo(`http://localhost:${srv.port}/ok.geojson`);
    expect(hits.filter((h) => h === "/ok.geojson").length).toBe(1);
    srv.stop();
  });
});

describe("featureCenters", () => {
  test("one bbox-centre point per feature, properties kept, empty geometry skipped", () => {
    const out = featureCenters({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { area_km2: 3.54 },
          geometry: { type: "Polygon", coordinates: [[[-48, -24], [-47, -24], [-47, -23], [-48, -24]]] } },
        { type: "Feature", properties: {},
          geometry: { type: "MultiPolygon", coordinates: [[[[0, 0], [2, 0], [2, 2], [0, 0]]], [[[4, 4], [5, 4], [5, 5], [4, 4]]]] } },
        { type: "Feature", properties: {}, geometry: null as never },
      ],
    });
    expect(out.features.map((f) => f.geometry.coordinates)).toEqual([[-47.5, -23.5], [2.5, 2.5]]);
    expect(out.features[0].properties).toEqual({ area_km2: 3.54 });
  });
});


describe("probLayerNote", () => {
  test("a published basis_label wins", () => {
    expect(probLayerNote({ id: "p_trigger_72h", date: "2026-11-15", basis_label: "observed Nov 8–14 + NOAA GFS forecast Nov 15–17 (issued 2026-11-15 00:00 UTC)" } as never))
      .toBe("observed Nov 8–14 + NOAA GFS forecast Nov 15–17 (issued 2026-11-15 00:00 UTC)");
  });
});


describe("probLayerNote drops lead-live's title prefix", () => {
  test("only the basis part stays", () => {
    expect(probLayerNote({ id: "p_trigger_7d", basis_label:
      "Relative likelihood of a rain-triggered landslide within 7d (when x where) — observed IMERG to Nov 14 + NOAA GFS forecast to Nov 21 (issued 2026-11-15 00:00 UTC)" } as never))
      .toBe("observed IMERG to Nov 14 + NOAA GFS forecast to Nov 21 (issued 2026-11-15 00:00 UTC)");
  });
});

describe("horizons from the data (ML v2)", () => {
  test("any <n>h/<n>d key, ordered by duration; labels and long range derived", () => {
    const layers = ["p_trigger_7d", "p_trigger_24h", "p_trigger_72h", "p_trigger_3d", "other"].map((id) => ({ id, png: "x.png" })) as never;
    expect(probHorizonsAvailable(layers)).toEqual(["24h", "72h", "3d", "7d"]);
    expect(horizonLabel("7d")).toBe("7 d");
    expect(horizonWords("7d")).toBe("7 days");
    expect(horizonWords("1d")).toBe("1 day");
    expect(isLongRange("7d")).toBe(true);
    expect(isLongRange("72h")).toBe(false);
    expect(isLongRange("72h", { low_skill: true })).toBe(true);
    expect(probLayerTitle("3d")).toBe("Relative likelihood of a rain-triggered landslide within 3 days (when × where)");
  });
});
