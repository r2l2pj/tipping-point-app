// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { describe, expect, test } from "bun:test";

import flatMetrics from "../../test/fixtures/metrics.flat.json";
import legacyMetrics from "../../test/fixtures/metrics.legacy.json";
import nowManifest from "../../test/fixtures/now.manifest.json";
import rootManifest from "../../test/fixtures/manifest.root.json";
import {
  caseAlias,
  canonicalCaseId,
  FORECAST_SOURCE_LABELS,
  forecastSourceLabel,
  resolveAsset,
  toMetricsView,
  toNowView,
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
    expect(toMetricsView({ cloud_pct: 1 })!.cloud_pct).toBe(1);
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

  test("empty input -> undefined", () => {
    expect(toMetricsView(undefined)).toBeUndefined();
    expect(toMetricsView(null)).toBeUndefined();
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

  test("gs:// urls map to storage.googleapis.com", () => {
    expect(resolveAsset(base, "now", "gs://tp-data/now/summary.json")).toBe(
      "https://storage.googleapis.com/tp-data/now/summary.json"
    );
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
    expect(FORECAST_SOURCE_LABELS["geos-fp"]).toBe("GEOS-FP");
    expect(forecastSourceLabel("perfect-forecast")).toBe("perfect forecast");
    expect(forecastSourceLabel("geos-fp")).toBe("GEOS-FP");
  });

  test("unknown sources pass through; missing -> undefined", () => {
    expect(forecastSourceLabel("other")).toBe("other");
    expect(forecastSourceLabel(undefined)).toBeUndefined();
    expect(forecastSourceLabel(null)).toBeUndefined();
  });
});
