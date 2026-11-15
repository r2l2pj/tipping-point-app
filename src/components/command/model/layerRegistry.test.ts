// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { overlayPlan, type ProbHorizon } from "@/lib/layers";
import { bundle, frame, liveBundle, manifest, point, zone, zones } from "./fixtures";
import {
  confirmRadarLayers, keepAvailable, layerRows, layerStateFor, MAX_LAYERS,
  overlaysFor, toggleLayer, type LayerId,
} from "./layerRegistry";
import { resolveFrameDate, resolveOverlays, zoneMarkersOn } from "./overlays";
import type { CcBundle } from "./types";
import { probLayerTitle } from "@/lib/layers";
import { layerLegendRows } from "./legend";

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
    expect(row("candidates").sub).toBe("pending");
  });

  test("the flood row carries the real pass dates and a label that follows the source", () => {
    expect(row("flood")).toMatchObject({
      label: "Flooded area (NISAR radar, candidates)",
      sub: "NISAR passes: Dec 4, 2025, Dec 16, 2025",
    });
    const rs = layerRows(bundle({ metricsView: { flood_source: "opera" } }), [], "slide");
    const flood = rs.find((r) => r.id === "flood")!;
    expect(flood.label).not.toContain("NISAR");
    expect(flood).toMatchObject({ available: false, sub: "No radar for this event (before NISAR launch)" });
  });

  test("a stamped data date shows the Brasília time; date-only stays date-only", () => {
    const timed = bundle({
      manifest: manifest([frame("imerg_x", "2025-12-10"), frame("smap_x", "2025-12-10")]),
      data_dates: { imerg: "2025-12-10T14:00:00Z", smap: "2025-12-10" },
    });
    const rows = layerRows(timed, [], "slide", "2025-12-10");
    expect(rows.find((r) => r.id === "imerg")!.sub).toBe("data Dec 10, 11:00 BRT");
    expect(rows.find((r) => r.id === "smap")!.sub).toBe("data Dec 10, 2025");
    // a stamped OPERA layer date gets the same treatment
    const opera = layerRows(
      bundle({ manifest: manifest([frame("opera_validation", "2025-12-10T14:00:00Z")]) }),
      [], "slide", "2025-12-10"
    );
    expect(opera.find((r) => r.id === "opera")!.sub).toBe("data Dec 10, 11:00 BRT");
  });

  test("replay evidence rows exist in Replay only", () => {
    expect(layerRows(liveBundle(), [], "slide").some((r) => r.group === "Replay evidence")).toBe(false);
    expect(rows.filter((r) => r.group === "Replay evidence").map((r) => r.id)).toEqual(["catalog", "opera", "ems"]);
  });

  test("no row says confirmed scar or confirmed landslide", () => {
    expect(JSON.stringify(rows)).not.toMatch(/confirmed (scar|landslide)/i);
  });
});

describe("P(trigger) probability row", () => {
  const prob = bundle({
    manifest: manifest([
      frame("tpi_slide", "2025-12-10"),
      ...(["24h", "48h", "72h", "7d", "14d"] as const).map((h) => frame(`p_trigger_${h}`, "2025-12-10")),
    ]),
  });
  const probRow = (b: CcBundle, h?: ProbHorizon, on: LayerId[] = ["ptrigger"]) =>
    layerRows(b, on, "slide", "2025-12-10", h).find((r) => r.id === "ptrigger")!;

  test("available when the case ships p_trigger horizon frames; the issued/forecast note is the sub", () => {
    expect(probRow(prob)).toMatchObject({
      available: true, on: true, label: "Relative likelihood of a rain-triggered landslide within 24 h (when × where)",
    });
    expect(probRow(prob).sub).toBe("issued Dec 10, 2025 · forecast: NOAA GFS");
  });

  test("the sub-line is the frame of the selected horizon", () => {
    const b = bundle({ manifest: manifest([
      frame("p_trigger_24h", "2025-12-10"),
      { ...frame("p_trigger_7d", "2025-12-10"), issued_at: "2025-12-09T12:00:00Z" },
    ]) });
    expect(probRow(b, "24h").sub).toContain("issued Dec 10, 2025");
    expect(probRow(b, "7d").sub).toContain("issued Dec 9, 2025");
  });

  test("available on horizon ids alone (no 24h) or on a legacy p_trigger raster", () => {
    expect(probRow(bundle({ manifest: manifest([frame("p_trigger_7d", "2025-12-10")]) })).available).toBe(true);
    expect(probRow(bundle({ manifest: manifest([frame("p_trigger", "2025-12-10")]) })).available).toBe(true);
  });

  test("without p_trigger frames the row is unavailable with the shared reason", () => {
    expect(probRow(bundle({ manifest: manifest([frame("tpi_slide", "2025-12-10")]) }))).toMatchObject({
      available: false, on: false, sub: "no map layer for this case",
    });
  });

  test("layerStateFor maps the row onto the pTrigger map toggle", () => {
    expect(layerStateFor(["ptrigger"], "slide").pTrigger).toBe(true);
    expect(layerStateFor(["tpi"], "slide").pTrigger).toBe(false);
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
    const ids: LayerId[] = ["tpi", "imerg", "smap", "tml", "ptrigger", "flood", "candidates", "catalog", "opera"];
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

  test("the probability row counts toward the budget; eviction names the rain-triggered likelihood", () => {
    expect(toggleLayer(["tpi", "flood"], "ptrigger")).toEqual({
      layers: ["flood", "ptrigger"], evicted: "tpi",
      notice: "TPI index turned off to show Rain-triggered landslide likelihood",
    });
    expect(toggleLayer(["ptrigger", "tpi"], "flood")).toEqual({
      layers: ["tpi", "flood"], evicted: "ptrigger",
      notice: "Rain-triggered landslide likelihood turned off to show Flood",
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
      operaValidation: false, mlHazard: false, emsFlood: false,
    });
    expect(layerStateFor(["tpi", "imerg"], "flood")).toEqual({
      tpiSlide: false, tpiFlood: true, imerg: true, smap: false, nisar: false, pTrigger: false, hand: false,
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
        nightLights: plan.nightLights, tml: true, ems: false,
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
      flood: true, scars: false, catalog: true, opera: false, nightLights: false, tml: false, ems: false,
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

describe("P(trigger) wording: relative likelihood, never a probability", () => {
  test("title follows the horizon; the legend has no percentage", () => {
    expect(probLayerTitle("72h")).toBe("Relative likelihood of a rain-triggered landslide within 72 h (when × where)");
    expect(probLayerTitle("7d")).toBe("Relative likelihood of a rain-triggered landslide within 7 days (when × where)");
    const legend = layerLegendRows(liveBundle(), ["ptrigger"]);
    expect(legend[0].label).toBe("Relative likelihood, low → high (not a percentage)");
    expect(JSON.stringify(legend)).not.toMatch(/probability|%/i);
  });
});

describe("OPERA validation legend (lead-analysis wa_2025/opera_validation.json)", () => {
  test("three classes in the PNG's colors, no cloud class", () => {
    const rows = layerLegendRows({} as never, ["opera"]);
    expect(rows.map((r) => [r.label, r.swatch])).toEqual([
      ["New flood in both NISAR and OPERA", "#1a9850"],
      ["NISAR only", "#f46d43"],
      ["NASA OPERA surface water (DSWx) only", "#4575b4"],
    ]);
  });
});

describe("Copernicus EMS flood layer (RS)", () => {
  test("available when the EMS scores are published; legend carries the attribution", async () => {
    const { layerAvailable, overlaysFor } = await import("./layerRegistry");
    const rs = bundle({ id: "rs_2024", metricsView: { flood_ems_iou: 0.185 } as never });
    expect(layerAvailable(rs, "ems", "flood")).toBe(true);
    expect(layerAvailable(bundle({ id: "wa_2025" }), "ems", "flood")).toBe(false);
    expect(overlaysFor(["ems"]).emsFlood).toBe(true);
    expect(layerLegendRows(rs, ["ems"])[0].label).toBe("Independent flood map (EU emergency service)");
  });
});

describe("L48: ML likelihood is the Now landslide default", () => {
  const pLayers = [{ id: "p_trigger_24h", date: "2026-11-15", png: "png/p_trigger_24h.png", kind: "forecast" },
    { id: "p_trigger_72h", date: "2026-11-15", png: "png/p_trigger_72h.png", kind: "forecast" },
    { id: "tpi_slide_d0", date: "2026-11-15", png: "png/tpi_slide_d0.png" }, { id: "tpi_flood_d0", date: "2026-11-15", png: "png/tpi_flood_d0.png" }];
  test("Now + landslide -> ptrigger; replay or flood -> TPI; hazard switch swaps", async () => {
    const { defaultLayersFor, swapForHazard, ML_SKILL_LINE, mlHorizonTip } = await import("./layerRegistry");
    const live = liveBundle({ manifest: { layers: pLayers } } as never);
    expect(defaultLayersFor(live, "slide")).toEqual(["ptrigger"]);
    expect(defaultLayersFor(live, "flood")).toEqual(["tpi"]);
    expect(defaultLayersFor(bundle(), "slide")).toEqual(["tpi"]);
    expect(swapForHazard(live, ["ptrigger", "flood"], "flood")).toEqual(["tpi", "flood"]);
    expect(swapForHazard(live, ["tpi", "flood"], "slide")).toEqual(["ptrigger", "flood"]);
    expect(ML_SKILL_LINE).toContain("Missed RS 2024 and Petrópolis.");
    expect(mlHorizonTip("24h", "2026-11-14", "2026-11-15T00:00:00Z")).toContain("observed IMERG to Nov 14, 2026 and the NOAA GFS run of Nov 15, 2026");
    expect(mlHorizonTip("7d")).toContain("never as a warning");
  });
});

test("L48: Now opens on Landslide + ML even when most zones are flood", async () => {
  const { initialState } = await import("../state");
  const live = liveBundle({ manifest: { layers: [{ id: "p_trigger_24h", date: "2026-11-15", png: "png/p_trigger_24h.png", kind: "forecast" },
    { id: "tpi_slide_d0", date: "2026-11-15", png: "png/tpi_slide_d0.png" }, { id: "tpi_flood_d0", date: "2026-11-15", png: "png/tpi_flood_d0.png" }] },
    zones: zones([zone(1, { hazard: "flood" }), zone(2, { hazard: "flood" })]) } as never);
  const s = initialState([live]);
  expect(s.hazard).toBe("slide");
  expect(s.layers[0]).toBe("ptrigger");
});

describe("F1b + calm ML day", () => {
  test("?layers=imerg,hand5&fit=imerg turns both on and fits the IMERG bounds; caption names IMERG Early + window", async () => {
    const { initialState } = await import("../state");
    const { mapCaption } = await import("./steps");
    const uy = bundle({ id: "rs_uruguai_2026", data_dates: {}, manifest: { event: "rs_uruguai_2026", layers: [
      { id: "imerg_20260930", date: "2026-09-30", window: ["2026-09-28", "2026-09-30"], product: "IMERG Early", kind: "observed", png: "rs_uruguai_2026/png/imerg_20260930.png", bounds: [-57.7, -31.5076, -49.1988, -26.2] },
      { id: "hand_low", kind: "static", png: "rs_uruguai_2026/png/hand_low.png", bounds: [-57.25, -29.8501, -56.4496, -29.05], legend: { stops: [{ color: "#1f78b4", label: "HAND ≤ 5 m" }] } },
    ] } } as never);
    const s = initialState([uy], "rs_uruguai_2026", "2026-09-30", { layers: "imerg,hand5", fit: "imerg" });
    expect(s.layers.sort()).toEqual(["hand", "imerg"]);
    expect(s.fitTo).toEqual([-57.7, -31.5076, -49.1988, -26.2]);
    const cap = mapCaption(uy, [], 0, "flood", ["imerg", "hand"]).text;
    expect(cap).toBe("Rain (NASA GPM IMERG Early, observed 3-day) · Sep 28–30, 2026");
    expect(cap).not.toContain("forecast · NOAA GFS");
    expect(layerLegendRows(uy, ["hand"])[0]).toEqual({ id: "hand", label: "Low ground (HAND ≤ 5 m)", swatch: "#1f78b4" });
  });
  test("ML legend says 'Low everywhere today' when lead-ml's stats.p99 < 0.1", () => {
    const live = liveBundle({ manifest: { layers: [{ id: "p_trigger_24h", date: "2026-11-15", png: "p.png", stats: { p50: 0.001, p99: 0.03, max: 0.2 } }] } } as never);
    expect(layerLegendRows(live, ["ptrigger"]).map((r) => r.label)).toContain("Low everywhere today (top 1% of land ≤ 0.03)");
    const busy = liveBundle({ manifest: { layers: [{ id: "p_trigger_24h", date: "2026-11-15", png: "p.png", stats: { p99: 0.4 } }] } } as never);
    expect(layerLegendRows(busy, ["ptrigger"]).some((r) => r.label.startsWith("Low everywhere"))).toBe(false);
  });
});

test("'Low everywhere today' follows the selected horizon (lead-ml 15:11Z: 24h p99 0.024, 7d 0.291)", () => {
  const live = liveBundle({ manifest: { layers: [
    { id: "p_trigger_24h", date: "2026-11-15", png: "a.png", stats: { p50: 0, p99: 0.024, max: 0.3, n_cells: 9 } },
    { id: "p_trigger_7d", date: "2026-11-15", png: "b.png", stats: { p50: 0.01, p99: 0.291, max: 0.9, n_cells: 9 } },
  ] } } as never);
  expect(layerLegendRows(live, ["ptrigger"], "24h").map((r) => r.label)).toContain("Low everywhere today (top 1% of land ≤ 0.02)");
  expect(layerLegendRows(live, ["ptrigger"], "7d").some((r) => r.label.startsWith("Low everywhere"))).toBe(false);
});

test("URGENT #2: in Now, stepping to a forecast day shows that day's TPI frame; today brings the ML layer back", async () => {
  const { initialState, reduce } = await import("../state");
  const L = [{ id: "p_trigger_24h", date: "2026-11-15", png: "p.png", kind: "forecast" },
    ...[0, 1, 2, 3].map((k) => ({ id: `tpi_slide_d${k}`, date: `2026-11-1${5 + k}`, png: `png/tpi_slide_d${k}.png`, forecast: k > 0 })),
    ...[0, 1, 2, 3].map((k) => ({ id: `tpi_flood_d${k}`, date: `2026-11-1${5 + k}`, png: `png/tpi_flood_d${k}.png`, forecast: k > 0 }))];
  const live = liveBundle({ manifest: { layers: L } } as never);
  let s = initialState([live]);
  expect(s.layers[0]).toBe("ptrigger");
  const today = s.dayIndex;
  s = reduce(s, { type: "next" } as never, [live]);
  expect(s.dayIndex).toBe(today + 1);
  expect(s.layers).toContain("tpi");
  expect(s.layers).not.toContain("ptrigger");
  s = reduce(s, { type: "prev" } as never, [live]);
  expect(s.layers).toContain("ptrigger");
});

test("conductor: Now forecast day caption 'Rain index forecast for <day>'; an ML chip returns to the ML view on today", async () => {
  const { initialState, reduce } = await import("../state");
  const { mapCaption } = await import("./steps");
  const { stepsFor } = await import("./steps");
  const L = [{ id: "p_trigger_24h", date: "2026-11-15", png: "p.png", kind: "forecast" }, { id: "p_trigger_72h", date: "2026-11-15", png: "p3.png", kind: "forecast" },
    ...[0, 1, 2, 3].map((k) => ({ id: `tpi_slide_d${k}`, date: `2026-11-1${5 + k}`, png: `png/tpi_slide_d${k}.png`, forecast: k > 0 }))];
  const live = liveBundle({ manifest: { layers: L } } as never);
  let s = reduce(initialState([live]), { type: "next" } as never, [live]);
  const cap = mapCaption(live, stepsFor(live), s.dayIndex, s.hazard, s.layers).text;
  expect(cap).toStartWith("Rain index forecast for Nov 16, 2026");
  s = reduce(s, { type: "setProbHorizon", horizon: "72h" } as never, [live]);
  expect(s.layers).toContain("ptrigger");
  expect(s.probHorizon).toBe("72h");
  expect(s.dayIndex).toBe(initialState([live]).dayIndex);
});

test("rain legend follows the manifest stops and note (re-rendered imerg PNG)", async () => {
  const { rainLegendRows } = await import("./legend");
  const layer = { id: "imerg_20260930", date: "2026-09-30", png: "x.png", legend: { unit: "mm", note: "transparent below 20 mm; orange/red = cells above the 95th/99th percentile of the season's BASIN-AVERAGE 3-day rain",
    stops: [{ v: 20, color: "#c6dbef", label: "20" }, { v: 62.5, color: "#fd8d3c", label: "62 (p95)" }, { v: 100, color: "#d7301f", label: "100 (p99)" }] } };
  const b = liveBundle({ manifest: { layers: [layer] } as never });
  const rows = layerLegendRows(b, ["imerg"], "24h", "2026-09-30");
  expect(rows[0].label).toBe("Rain, 3 days (mm): 20 · 62 (p95) · 100 (p99)");
  expect(rows[0].swatch).toContain("#fd8d3c");
  expect(rows[1]).toMatchObject({ note: true });
  expect(rows[1].label).toContain("basin-average");
  expect(rainLegendRows(liveBundle(), "2026-09-30")).toBeUndefined();
  expect(layerLegendRows(liveBundle(), ["imerg"])[0].label).toBe("Rain (GPM IMERG)");
});
