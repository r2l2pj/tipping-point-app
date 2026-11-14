// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { overlayPlan } from "@/lib/layers";
import { bundle, frame, liveBundle, manifest, point, zones } from "./fixtures";
import {
  confirmRadarLayers, keepAvailable, layerRows, layerStateFor, MAX_LAYERS,
  overlaysFor, toggleLayer, type LayerId,
} from "./layerRegistry";
import { resolveFrameDate, resolveOverlays, zoneMarkersOn } from "./overlays";

const fc = (n: number): GeoJSON.FeatureCollection => zones(Array.from({ length: n }, () => point()));

const wa = bundle({
  manifest: manifest([frame("tpi_slide", "2025-12-10"), frame("tpi_flood", "2025-12-10")]),
  data_dates: { imerg: "2025-12-20", nisar_pre: "2025-12-04", nisar_post: "2025-12-16" },
  flood: fc(2),
  catalog: fc(1),
  nullReasons: { landslide_candidates: "no landslide candidate product yet" },
});

describe("layer rows", () => {
  const rows = layerRows(wa, ["tpi"], "slide", "2025-12-10");
  const row = (id: LayerId) => rows.find((r) => r.id === id)!;

  test("a row is available when the case has the raster or the product", () => {
    expect(rows.filter((r) => r.available).map((r) => r.id)).toEqual(["tpi", "flood", "catalog"]);
    expect(row("tpi")).toMatchObject({ on: true, label: "TPI index (Landslide)", sub: "data Dec 10, 2025" });
  });

  test("the TPI row shows the provenance of the frame when published", () => {
    const b = bundle({ manifest: manifest(
      [{ ...frame("tpi_slide", "2025-12-10"), data_basis: "final data, hindcast" }, frame("tpi_slide", "2025-12-11")],
      { data_basis: "case basis" }) });
    expect(layerRows(b, ["tpi"], "slide", "2025-12-10")[0].sub).toBe("data Dec 10, 2025 · final data, hindcast");
    expect(layerRows(b, ["tpi"], "slide", "2025-12-11")[0].sub).toBe("data Dec 11, 2025 · case basis");
  });

  test("a row without data is greyed with its reason", () => {
    expect(row("imerg")).toMatchObject({ available: false, sub: "no map layer for this case" });
    expect(row("candidates").sub).toBe("not published yet (no landslide candidate product yet)");
  });

  test("the flood row carries the real pass dates and a label that follows the source", () => {
    expect(row("flood")).toMatchObject({
      label: "Flood confirmed by radar (NISAR)",
      sub: "NISAR passes: Dec 4, 2025, Dec 16, 2025",
    });
    const rs = layerRows(bundle({ metricsView: { flood_source: "opera" } }), [], "slide");
    const flood = rs.find((r) => r.id === "flood")!;
    expect(flood.label).not.toContain("NISAR");
    expect(flood).toMatchObject({ available: false, sub: "No radar for this event (before NISAR launch)" });
  });

  test("replay evidence rows exist in Replay only", () => {
    expect(layerRows(liveBundle(), [], "slide").some((r) => r.group === "Replay evidence")).toBe(false);
    expect(rows.filter((r) => r.group === "Replay evidence").map((r) => r.id)).toEqual(["catalog", "opera"]);
  });

  test("no row says confirmed scar or confirmed landslide", () => {
    expect(JSON.stringify(rows)).not.toMatch(/confirmed (scar|landslide)/i);
  });
});

describe("layer rows on the trimmed bundle (products by URL)", () => {
  const trimmed = bundle({
    manifest: manifest([frame("tpi_slide", "2025-12-10")]),
    products: {
      flood_confirmed: "wa_2025/geojson/flood_confirmed.geojson",
      landslide_catalog: "wa_2025/geojson/landslide_catalog.geojson",
      landslide_candidates: null,
    } as never,
  });

  test("a declared product is available without the file in the bundle", () => {
    const rows = layerRows(trimmed, ["tpi"], "slide");
    expect(rows.filter((r) => r.available).map((r) => r.id)).toEqual(["tpi", "flood", "catalog"]);
    expect(keepAvailable(trimmed, ["flood", "candidates"], "slide")).toEqual(["flood"]);
  });

  test("an undeclared product is not available (nothing is fetched for it)", () => {
    const rows = layerRows(liveBundle(), [], "slide");
    expect(rows.find((r) => r.id === "flood")!.available).toBe(false);
  });
});

describe("layer budget", () => {
  test("at most two data layers after any sequence of toggles; the evicted layer is named", () => {
    const ids: LayerId[] = ["tpi", "imerg", "smap", "tml", "flood", "candidates", "catalog", "opera"];
    let on: LayerId[] = ["tpi"];
    let seed = 7;
    for (let i = 0; i < 500; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const id = ids[seed % ids.length];
      const before = on;
      const result = toggleLayer(on, id);
      on = result.layers;
      expect(on.length).toBeLessThanOrEqual(MAX_LAYERS);
      expect(new Set(on).size).toBe(on.length);
      if (!before.includes(id) && before.length === MAX_LAYERS) {
        expect(result.evicted).toBe(before[0]);
        expect(result.notice).toContain("turned off to show");
        expect(on).toEqual([before[1], id]);
      } else {
        expect(result.evicted).toBeUndefined();
        expect(result.notice).toBeUndefined();
      }
    }
  });

  test("the notice names both layers", () => {
    expect(toggleLayer(["imerg", "tpi"], "flood")).toEqual({
      layers: ["tpi", "flood"], evicted: "imerg", notice: "Rain turned off to show Flood",
    });
  });

  test("'Confirm with NISAR radar' sets exactly TPI plus the flood polygons", () => {
    expect(confirmRadarLayers(["tpi"])).toEqual({ layers: ["tpi", "flood"], evicted: undefined, notice: undefined });
    expect(confirmRadarLayers(["catalog", "smap"])).toMatchObject({
      layers: ["tpi", "flood"],
      notice: "Landslide catalog and Soil moisture turned off to show Flood",
    });
  });

  test("a case change drops the layers the new case lacks", () => {
    expect(keepAvailable(wa, ["imerg", "flood"], "slide")).toEqual(["flood"]);
    expect(keepAvailable(liveBundle(), ["tpi", "flood"], "slide")).toEqual([]);
  });

  test("hook input: one overlay per row, one TPI raster for the chosen hazard", () => {
    expect(overlaysFor(["tpi", "flood"])).toEqual({
      floodPolygons: true, landslideCandidates: false, catalogPoints: false,
      operaValidation: false, mlHazard: false,
    });
    expect(layerStateFor(["tpi", "imerg"], "flood")).toEqual({
      tpiSlide: false, tpiFlood: true, imerg: true, smap: false, nisar: false,
    });
    expect(layerStateFor(["imerg"], "slide").tpiSlide).toBe(false);
  });
});

describe("useMapLayers options (pure part)", () => {
  test("without options the result equals the tab plan of the old screen", () => {
    for (const tab of ["alert", "radar", "validation", "impact", "unknown"]) {
      const plan = overlayPlan(tab);
      expect(resolveOverlays(tab, false, false)).toEqual({
        flood: plan.floodPolygons, scars: plan.landslideCandidates,
        catalog: plan.catalogPoints, opera: plan.operaValidation,
        nightLights: plan.nightLights, tml: true,
      });
    }
  });

  test("without options and without a tab, showFlood and the nisar toggle decide", () => {
    expect(resolveOverlays(undefined, true, false)).toMatchObject({ flood: true, scars: true, catalog: false, opera: false, nightLights: false, tml: true });
    expect(resolveOverlays(undefined, false, true)).toMatchObject({ flood: false, scars: true });
    expect(resolveOverlays(undefined, false, false)).toMatchObject({ flood: false, scars: false });
  });

  test("explicit overlays replace the tab plan and showFlood", () => {
    const overlays = overlaysFor(["flood", "catalog"]);
    expect(resolveOverlays("radar", true, true, overlays)).toEqual({
      flood: true, scars: false, catalog: true, opera: false, nightLights: false, tml: false,
    });
  });

  test("the NISAR toggle no longer draws optical candidates under explicit overlays", () => {
    expect(resolveOverlays(undefined, false, true, overlaysFor(["flood"])).scars).toBe(false);
  });

  test("frameDate overrides the series day; zone markers default on", () => {
    expect(resolveFrameDate("2025-12-10")).toBe("2025-12-10");
    expect(resolveFrameDate(undefined, { frameDate: "2026-11-14" })).toBe("2026-11-14");
    expect(resolveFrameDate("2025-12-10", { frameDate: "2025-12-11" })).toBe("2025-12-11");
    expect(zoneMarkersOn()).toBe(true);
    expect(zoneMarkersOn({})).toBe(true);
    expect(zoneMarkersOn({ zoneMarkers: false })).toBe(false);
  });
});
