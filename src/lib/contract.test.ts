// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { describe, expect, test } from "bun:test";

import flatMetrics from "../../test/fixtures/metrics.flat.json";
import legacyMetrics from "../../test/fixtures/metrics.legacy.json";
import nowManifest from "../../test/fixtures/now.manifest.json";
import realMetrics from "../../test/fixtures/metrics-19c56df.json";
import rootManifest from "../../test/fixtures/manifest.root.json";
import {
  caseAlias,
  canonicalCaseId,
  flattenLandslideHit,
  FORECAST_SOURCE_LABELS,
  forecastSourceLabel,
  resolveAsset,
  toMetricsView,
  toNowView,
  liveClasses,
  liveCriticalKm2,
  liveSummaryV2,
} from "./contract";

describe("toMetricsView", () => {
  const flat = toMetricsView(flatMetrics)!;
  const legacy = toMetricsView(legacyMetrics)!;

  test("flat v4 input keeps flat keys", () => {
    expect(flat.event).toBe("wa-2025-12");
    expect(flat.iou).toBe(0.71);
    expect(flat.f1).toBe(0.83);
    expect(flat.people_flooded).toBe(2100);
    expect(flat.lead_time_mean_h).toBe(47.5);
    expect(flat.rule_auc).toBe(0.74);
    expect(flat.feature_importance).toEqual({
      imerg_p95_mm: 0.41,
      smap_l4: 0.33,
      nasadem_slope: 0.26,
    });
    expect(flat.forecast_source).toBe("perfect-forecast");
  });

  test("flat flood sources pass through without making an absent source claim", () => {
    for (const flood_source of ["nisar", "opera", "observed"] as const) {
      expect(toMetricsView({ ...flatMetrics, flood_source })!.flood_source).toBe(flood_source);
    }
    expect(toMetricsView({ ...flatMetrics, flood_source: null })!.flood_source).toBeNull();
    expect(flat.flood_source).toBeUndefined();
  });

  test("legacy nested metrics do not claim a flood source", () => {
    expect(legacy.flood_source).toBeUndefined();
    expect(toMetricsView({ ...legacyMetrics, flood_source: "nisar" })!.flood_source).toBeUndefined();
  });

  test("flood source survives normalization of every percent key", () => {
    const view = toMetricsView({
      flood_source: "opera",
      cloud_pct: 94,
      landslide_hit_pct: 62,
      hand_validation: 78,
      night_light_drop_pct: 18,
      warned_before_pct: 87,
    })!;
    expect(view).toMatchObject({
      flood_source: "opera",
      cloud_pct: 0.94,
      landslide_hit_pct: 0.62,
      hand_validation: 0.78,
      night_light_drop_pct: 0.18,
      warned_before_pct: 0.87,
    });
  });

  test("percent fields arriving on a 0-100 scale normalize to 0-1", () => {
    expect(flat.cloud_pct).toBe(0.94);
    expect(flat.night_light_drop_pct).toBe(0.18);
    expect(flat.warned_before_pct).toBe(0.87);
  });

  test("percent fields already on a 0-1 scale pass through", () => {
    expect(flat.landslide_hit_pct).toBe(0.62);
    expect(flat.hand_validation).toBe(0.78);
    expect(toMetricsView({ cloud_pct: 0.5 })!.cloud_pct).toBe(0.5);
  });

  // N3 regression: *_pct is authored 0-100, so exactly 1 means 1%, not 100%.
  test("percent edge: values >= 1 read as the 0-100 scale", () => {
    for (const [input, expected] of [
      [0, 0],
      [0.99, 0.99],
      [1, 0.01],
      [50, 0.5],
      [100, 1],
    ] as const) {
      expect(toMetricsView({ cloud_pct: input })!.cloud_pct).toBe(expected);
    }
  });

  test("analysis keys pass through; swath_coverage_pct normalizes like other percents", () => {
    const clusters = [{ area_km2: 4.2, lat: -29.1, lon: -51.6, where: "Caxias do Sul" }];
    const radii = { "500": 0.41, "1000": 0.52 };
    const view = toMetricsView({
      swath_coverage_pct: 73,
      flooded_km2_scope: "within NISAR swath",
      flood_top_clusters: clusters,
      hand_validation_radii: radii,
      hand_best_radius_m: 1000,
    })!;
    expect(view.swath_coverage_pct).toBe(0.73);
    expect(view.flooded_km2_scope).toBe("within NISAR swath");
    expect(view.flood_top_clusters).toBe(clusters);
    expect(view.hand_validation_radii).toBe(radii);
    expect(view.hand_best_radius_m).toBe(1000);
    expect(toMetricsView({})!.swath_coverage_pct).toBeUndefined();
  });

  test("legacy nested mock maps onto the flat view", () => {
    expect(legacy.event).toBe("wa-2025-12");
    expect(legacy.iou).toBe(0.71);
    expect(legacy.f1).toBe(0.83);
    expect(legacy.flooded_km2).toBe(41.6);
    expect(legacy.rf_auc).toBe(0.91);
    expect(legacy.lead_time_median_h).toBe(52);
    expect(legacy.warned_before_pct).toBe(0.87);
    expect(legacy.cloud_pct).toBe(0.94);
    expect(legacy.people_critical).toBe(8400);
    expect(legacy.night_light_drop_pct).toBe(0.18);
  });

  test("nested and flat shapes normalize identically on shared keys", () => {
    const shared = [
      "iou",
      "f1",
      "cloud_pct",
      "warned_before_pct",
      "night_light_drop_pct",
      "people_critical",
      "flooded_km2",
      "rf_auc",
      "lead_time_median_h",
    ] as const;
    for (const k of shared) expect(legacy[k]).toBe(flat[k]);
  });

  test("lead-time percent keys normalize like other percent fields", () => {
    const view = toMetricsView({
      warned_24h_pct: 64,
      never_critical_pct: 0.12,
      critical_area_with_damage_pct: 27,
    })!;
    expect(view.warned_24h_pct).toBe(0.64);
    expect(view.never_critical_pct).toBe(0.12);
    expect(view.critical_area_with_damage_pct).toBe(0.27);
  });

  test("lead-time structured keys pass through untouched", () => {
    const iqr: [number, number] = [32, 61];
    const hist = { bin_h: 6, from_h: -12, counts: [2, 4, 15, 46] };
    const anchor = { at: "2024-05-02T03:00:00Z", source: "placeholder" };
    const assumptions = { imerg: "IMERG Early ~4h latency", quality: "placeholder" };
    const view = toMetricsView({
      lead_time_iqr_h: iqr,
      lead_time_hist: hist,
      damage_anchor: anchor,
      lead_time_assumptions: assumptions,
      warned_24h_pct: 64,
    })!;
    expect(view.lead_time_iqr_h).toBe(iqr);
    expect(view.lead_time_hist).toBe(hist);
    expect(view.damage_anchor).toBe(anchor);
    expect(view.lead_time_assumptions).toBe(assumptions);
  });

  test("legacy nested metrics do not synthesize lead-time keys", () => {
    expect(legacy.lead_time_iqr_h).toBeUndefined();
    expect(legacy.warned_24h_pct).toBeUndefined();
    expect(legacy.never_critical_pct).toBeUndefined();
    expect(legacy.n_points).toBeUndefined();
    expect(legacy.damage_anchor).toBeUndefined();
    expect(legacy.lead_time_hist).toBeUndefined();
    expect(legacy.critical_area_km2).toBeUndefined();
  });

  test("empty input -> undefined", () => {
    expect(toMetricsView(undefined)).toBeUndefined();
    expect(toMetricsView(null)).toBeUndefined();
  });
});

// Real fallback-branch metrics (pinned 19c56df) — not a mock.
describe("real metrics fixture (19c56df)", () => {
  const wa = toMetricsView(realMetrics.cases.wa_2025)!;
  const rs = toMetricsView(realMetrics.cases.rs_2024)!;

  test("wa_2025 new keys flow to the view; swath_coverage_pct normalizes", () => {
    expect(wa.flooded_km2).toBeCloseTo(27.986782691534348, 10);
    expect(wa.water_km2).toBeCloseTo(304.07798965256404, 10);
    expect(wa.threshold_db).toBe(-15);
    expect(wa.flood_bright_km2).toBeCloseTo(0.6621649771870278, 10);
    expect(wa.swath_coverage_pct).toBeCloseTo(0.741, 5);
    expect(wa.flooded_km2_scope).toBe("within NISAR swath");
    expect(wa.flood_top_clusters).toHaveLength(5);
    expect(wa.flood_top_clusters?.[0]).toMatchObject({
      area_km2: 10.61,
      lat: 47.91,
      lon: -122.153,
    });
  });

  test("rs_2024 nested landslide_hit passes through; no flat hit_pct synthesized by toMetricsView", () => {
    expect(rs.landslide_hit?.n_points).toBe(16027);
    expect(rs.landslide_hit?.per_day).toHaveLength(3);
    expect(rs.landslide_hit?.scale_m).toBe(90);
    expect(rs.landslide_hit_pct).toBeUndefined();
  });

  test("flattenLandslideHit derives the event-day hit_pct, normalized like other percents", () => {
    // 2024-05-02 hit_pct 85.855 -> 0.85855
    expect(flattenLandslideHit(rs, "2024-05-02")?.landslide_hit_pct).toBeCloseTo(0.85855, 5);
    // unknown/absent date -> last per_day entry
    expect(flattenLandslideHit(rs, "1999-01-01")?.landslide_hit_pct).toBeCloseTo(0.85855, 5);
    expect(flattenLandslideHit(rs)?.landslide_hit_pct).toBeCloseTo(0.85855, 5);
    // an earlier date picks its own entry
    expect(flattenLandslideHit(rs, "2024-05-01")?.landslide_hit_pct).toBeCloseTo(0.84863, 5);
  });

  test("flattenLandslideHit is a no-op for flat input, missing hit data, or missing view", () => {
    const flat = toMetricsView({ landslide_hit_pct: 0.62 })!;
    expect(flattenLandslideHit(flat, "2024-05-02")?.landslide_hit_pct).toBe(0.62);
    expect(flattenLandslideHit(toMetricsView({ iou: 0.5 }))?.landslide_hit_pct).toBeUndefined();
    expect(flattenLandslideHit(undefined)).toBeUndefined();
  });
});

describe("toNowView", () => {
  const view = toNowView(nowManifest)!;

  test("carries the now@2 node fields", () => {
    expect(view.schema).toBe("tipping-point/now@2");
    expect(view.mode).toBe("live");
    expect(view.updated_at).toBe("2026-11-14T12:00:00Z");
    expect(view.bounds).toEqual([-58.0, -34.0, -48.0, -22.5]);
    expect(view.forecast_source).toBe("geos-fp");
    expect(view.data_dates?.geos_fp_issued).toBe("2026-11-14T00:00:00Z");
  });

  test("products map and top-level nisar_passes", () => {
    expect(view.products).toEqual({
      critical_areas: "geojson/critical_areas.geojson",
      summary: "summary.json",
      alerts: "alerts.json",
    });
    expect(view.nisar_passes).toHaveLength(2);
    expect(view.nisar_passes[0].track).toBe("172D");
  });

  test("explicit forecast flag is honored", () => {
    expect(view.layers[0]).toMatchObject({ id: "tpi_slide_d0", forecast: false });
    expect(view.layers[1]).toMatchObject({ id: "tpi_slide_d1", forecast: true });
  });

  test("_d[1-3] id marks a forecast day when the flag is absent", () => {
    expect(view.layers[2]).toMatchObject({ id: "tpi_flood_d2", forecast: true });
    const v = toNowView({ layers: [{ id: "tpi_slide_d3" }, { id: "tpi_slide" }] })!;
    expect(v.layers.map((l) => l.forecast)).toEqual([true, false]);
  });

  test("explicit flag wins over the _d<k> fallback", () => {
    const v = toNowView({ layers: [{ id: "tpi_slide_d2", forecast: false }] })!;
    expect(v.layers[0].forecast).toBe(false);
  });

  test("nisar_passes falls back to data_dates (legacy placement)", () => {
    const v = toNowView({
      data_dates: { nisar_passes: [{ date: "2026-11-09", track: "172D" }] },
    })!;
    expect(v.nisar_passes).toHaveLength(1);
    expect(v.nisar_passes[0].date).toBe("2026-11-09");
  });

  test("empty input -> undefined", () => {
    expect(toNowView(undefined)).toBeUndefined();
    expect(toNowView("x")).toBeUndefined();
  });
});

describe("caseAlias / canonicalCaseId", () => {
  test("maps both directions and round-trips", () => {
    for (const [canonical, alias] of [
      ["rs_2024", "rs-2024-05"],
      ["wa_2025", "wa-2025-12"],
    ]) {
      expect(caseAlias(alias)).toBe(canonical);
      expect(caseAlias(canonical)).toBe(alias);
      expect(caseAlias(caseAlias(alias)!)).toBe(alias);
    }
  });

  test("unknown ids -> undefined; canonicalCaseId passes them through", () => {
    expect(caseAlias("now")).toBeUndefined();
    expect(canonicalCaseId("rs-2024-05")).toBe("rs_2024");
    expect(canonicalCaseId("wa_2025")).toBe("wa_2025");
    expect(canonicalCaseId("now")).toBe("now");
  });

  test("root manifest keys are canonical; event_id is the hyphen alias", () => {
    const cases = rootManifest.cases;
    expect(Object.keys(cases)).toEqual(["rs_2024", "wa_2025", "now"]);
    expect(caseAlias(cases.rs_2024.event_id)).toBe("rs_2024");
    expect(caseAlias(cases.wa_2025.event_id)).toBe("wa_2025");
    expect(cases.rs_2024.forecast_source).toBe("perfect-forecast");
    expect(cases.rs_2024.products?.swot).toBe("rs_2024/series/swot.json");
  });
});

describe("resolveAsset", () => {
  const base = "https://storage.googleapis.com/tp-data";

  test("bucket-relative path resolves under base/caseDir", () => {
    expect(resolveAsset(base, "now", "png/tpi_slide_d0.png")).toBe(
      "https://storage.googleapis.com/tp-data/now/png/tpi_slide_d0.png"
    );
  });

  test("paths already carrying the case dir are not doubled", () => {
    expect(resolveAsset(base, "wa-2025-12", "wa-2025-12/png/tpi_slide_20251207.png")).toBe(
      "https://storage.googleapis.com/tp-data/wa-2025-12/png/tpi_slide_20251207.png"
    );
    expect(resolveAsset(`${base}/`, "rs_2024", "rs_2024/metrics.json")).toBe(
      "https://storage.googleapis.com/tp-data/rs_2024/metrics.json"
    );
  });

  test("gs:// paths follow the same resolution as other unrecognized schemes", () => {
    for (const scheme of ["gs", "custom"]) {
      expect(resolveAsset(base, "now", `${scheme}://tp-data/now/summary.json`)).toBe(
        `${base}/now/${scheme}://tp-data/now/summary.json`
      );
      expect(resolveAsset("", "now", `${scheme}://tp-data/now/summary.json`)).toBe(
        `now/${scheme}://tp-data/now/summary.json`
      );
    }
  });

  test("absolute http(s) urls pass through", () => {
    const url = "https://example.com/x.png";
    expect(resolveAsset(base, "now", url)).toBe(url);
    expect(resolveAsset(base, "now", "http://example.com/x.png")).toBe(
      "http://example.com/x.png"
    );
  });

  test("null/undefined/empty -> undefined", () => {
    expect(resolveAsset(base, "now", null)).toBeUndefined();
    expect(resolveAsset(base, "now", undefined)).toBeUndefined();
    expect(resolveAsset(base, "now", "")).toBeUndefined();
  });
});

describe("forecast_source labels", () => {
  test("map and label helper", () => {
    expect(FORECAST_SOURCE_LABELS["perfect-forecast"]).toBe("perfect forecast");
    expect(FORECAST_SOURCE_LABELS["geos-fp"]).toBe("older forecast run");
    expect(forecastSourceLabel("perfect-forecast")).toBe("perfect forecast");
    expect(forecastSourceLabel("geos-fp")).toBe("older forecast run");
  });

  test("unknown sources pass through; missing -> undefined", () => {
    expect(forecastSourceLabel("other")).toBe("other");
    expect(forecastSourceLabel(undefined)).toBeUndefined();
    expect(forecastSourceLabel(null)).toBeUndefined();
  });
});

describe("live summary v1 / v2 (per-hazard classes)", () => {
  const v1 = { critical_km2: { slide: 0, flood: 98.6, any: 98.6 }, classes_km2: { Baixo: 9, Moderado: 1, Alto: 2, Crítico: 98.6 } };
  const v2 = {
    critical_km2: { slide: 12, flood: 130, any: 140 }, // High + Critical in v2
    classes_km2: {
      landslide: { Baixo: 100, Moderado: 5, Alto: 10, Crítico: 2 },
      flood: { Baixo: 90, Moderado: 7, Alto: 100, Crítico: 30 },
    },
  };
  test("v1: critical_km2 per hazard, flat classes", () => {
    expect(liveSummaryV2(v1 as never)).toBe(false);
    expect(liveCriticalKm2(v1 as never, "flood")).toBe(98.6);
    expect(liveClasses(v1 as never, "slide")).toEqual(v1.classes_km2);
  });
  test("v2: Critical is the per-hazard Crítico class, never High + Critical", () => {
    expect(liveSummaryV2(v2 as never)).toBe(true);
    expect(liveCriticalKm2(v2 as never, "slide")).toBe(2);
    expect(liveCriticalKm2(v2 as never, "flood")).toBe(30);
    expect(liveClasses(v2 as never, "flood")).toEqual(v2.classes_km2.flood);
    expect(liveClasses(v2 as never, "slide")).toEqual(v2.classes_km2.landslide);
  });
  test("nothing published reads undefined", () => {
    expect(liveCriticalKm2(undefined, "flood")).toBeUndefined();
    expect(liveClasses({} as never, "flood")).toBeUndefined();
  });
});
