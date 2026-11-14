// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { describe, expect, test } from "bun:test";

import type { DayPoint } from "./types";
import {
  assetUrl,
  fmtDate,
  fmtDateTime,
  isForecastLayer,
  overlayPlan,
  pointInPolygons,
  resolvePixelValues,
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
    expect(overlayPlan("alert")).toEqual({ tpi: true, ...OFF });
  });

  test("radar adds flood polygons and landslide candidates", () => {
    expect(overlayPlan("radar")).toEqual({
      tpi: true,
      ...OFF,
      floodPolygons: true,
      landslideCandidates: true,
    });
  });

  test("validation adds catalog points and the OPERA raster", () => {
    expect(overlayPlan("validation")).toEqual({
      tpi: true,
      ...OFF,
      catalogPoints: true,
      operaValidation: true,
    });
  });

  test("impact adds the night-lights raster", () => {
    expect(overlayPlan("impact")).toEqual({
      tpi: true,
      ...OFF,
      nightLights: true,
    });
  });

  test("no tab / unknown tab behaves like alert", () => {
    expect(overlayPlan(undefined)).toEqual({ tpi: true, ...OFF });
    expect(overlayPlan("bogus")).toEqual({ tpi: true, ...OFF });
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
  test("absolute and gs:// URLs pass through", () => {
    expect(assetUrl("wa_2025", "https://x/y.png")).toBe("https://x/y.png");
    expect(assetUrl("wa_2025", "gs://bucket/key.png")).toBe(
      "https://storage.googleapis.com/bucket/key.png"
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
});

describe("resolvePixelValues", () => {
  const day = { imerg_mm: 61, smap: 0.8, tpi: 0.7 } as DayPoint;

  test("no cog URL resolves to null", async () => {
    await expect(resolvePixelValues(undefined, 0, 0)).resolves.toBeNull();
  });

  test("with a cog URL returns the day-level approximation for now", async () => {
    const px = await resolvePixelValues("/data/x/cog.tif", -51, -30, {
      day,
      rainP95Mm: 61,
      tpi: 0.7,
    });
    expect(px?.tpi).toBe(0.7);
    expect(px?.r).toBe(1); // 61mm / p95 61mm
    expect(px?.s).toBe(0.8);
    expect(px?.t).toBeCloseTo(0.42875, 4);
  });
});
