// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { CaseBundle, PriorityZone } from "../../lib/types";
import SidePanel, { type TabKey } from "../SidePanel";
import { normalizeLeadTimeHist } from "../charts/LeadTimeHistogram";
import Timeline from "../Timeline";
import { fmtBrt } from "./format";
import { cutsFor, tpiClass } from "../../lib/tpi";
import { fmtDate, forecastChip, pickTpiFrame } from "../../lib/layers";
import { toMetricsView } from "../../lib/contract";
import { opticalSeenPct } from "./ValidationTab";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const noop = () => {};

const bundle = (over: Partial<CaseBundle> = {}): CaseBundle => ({
  id: "wa_2025",
  title: "WA 2025",
  mode: "replay",
  bbox: [-122.6, 47.0, -121.5, 48.5],
  reference_date: "2025-12-10",
  ...over,
});

const render = (tab: TabKey, b: CaseBundle, dayIndex = 0, zones: PriorityZone[] = []) =>
  renderToStaticMarkup(
    <SidePanel
      tab={tab}
      onTab={noop}
      bundle={b}
      zones={zones}
      dayIndex={dayIndex}
      onConfirmRadar={noop}
    />
  );

const scarFeature = (): GeoJSON.Feature => ({
  type: "Feature",
  properties: {},
  geometry: { type: "Point", coordinates: [-121.9, 47.8] },
});

const FULL_METRICS: CaseBundle["metricsView"] = {
  iou: 0.71,
  f1: 0.83,
  cloud_pct: 0.95,
  landslide_hit_pct: 0.62,
  hand_validation: 0.78,
  people_critical: 8400,
  people_flooded: 2100,
  flooded_km2: 41.6,
  night_light_drop_pct: 0.18,
  lead_time_mean_h: 47.5,
  lead_time_median_h: 52,
  warned_before_pct: 0.87,
  rf_auc: 0.91,
  rule_auc: 0.74,
  feature_importance: { imerg_p95_mm: 0.41, smap_l4: 0.33, nasadem_slope: 0.26 },
  forecast_source: "perfect-forecast",
};

describe("alert playback and contract values", () => {
  const replay = bundle({ series: {
    event: "wa_2025", reference_date: "2025-12-10", tpi_threshold: 0.75,
    days: [0.7, 0.75, 0.4].map((tpi, offset) => ({
      date: `2025-12-${10 + offset}`, offset, kind: "observed", tpi, imerg_mm: 10, smap: 0.9,
    })),
  } });

  test("reached follows the selected day, including equality and rewinding", () => {
    for (const index of [0, 2, 9, 0]) {
      expect(render("alert", replay, index)).toContain("TIPPING POINT WATCH");
    }
    expect(render("alert", replay, 1)).toContain("TIPPING POINT REACHED");
    expect(render("alert", bundle())).toContain("MONITORING PENDING");
  });

  test("class cuts supply the threshold when the series has none", () => {
    const b = { ...replay, classCuts: [0.1, 0.3, 0.8],
      series: { ...replay.series!, tpi_threshold: undefined } };
    expect(render("alert", b, 1)).toContain("TIPPING POINT WATCH");
    expect(render("alert", b, 1)).toContain("Priority zones (TPI ≥ 0.80)");
  });

  test("cuts are validated and resolve bundle before manifest before defaults", () => {
    expect(cutsFor()).toEqual([0.2, 0.4, 0.6]);
    for (const classCuts of [[0.4, 0.2, 0.6], [0.1, NaN, 0.8], [0.1, 0.2], [-1, 0.3, 0.8]]) {
      expect(cutsFor({ classCuts })).toEqual([0.2, 0.4, 0.6]);
    }
    const b = { classCuts: [0.1, 0.3, 0.8], manifest: { tpi_cuts: [0.2, 0.5, 0.9] } };
    expect(cutsFor(b)).toEqual([0.1, 0.3, 0.8]);
    expect(cutsFor({ ...b, tpiCuts: [0.15, 0.45, 0.85] })).toEqual([0.15, 0.45, 0.85]);
    expect(cutsFor({ ...b, tpiCuts: [0.8, 0.4, 0.2] })).toEqual([0.1, 0.3, 0.8]);
    expect(cutsFor({ manifest: b.manifest })).toEqual([0.2, 0.5, 0.9]);
    expect(cutsFor({ classCuts: null, manifest: b.manifest })).toEqual([0.2, 0.5, 0.9]);
    expect(cutsFor({ manifest: { classes: [0.1, 0.3, 0.8] } })).toEqual([0.1, 0.3, 0.8]);
    expect(cutsFor({ manifest: { classes: [{ min: 0 }, { min: 0.1 }, { min: 0.3 }, { min: 0.8 }] } })).toEqual([0.1, 0.3, 0.8]);
    expect(tpiClass(0.7, b).key).toBe("high");
    expect(tpiClass(0.8, b).key).toBe("critical");
  });

  test("canonical dates preserve calendar dates and render timestamps in BRT", () => {
    expect(fmtDate("2026-11-11")).toBe("Nov 11, 2026");
    expect(fmtDate("2026-11-11T01:00:00Z")).toBe("Nov 10, 2026");
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("invalid")).toBe("invalid");
  });
});

describe("validation tab on metricsView", () => {
  test("published wa_2025 keys: like-for-like headline, *_raw secondary", () => {
    const wa = toMetricsView({
      iou: 0.08159565666049996, f1: 0.1508801485250636,
      precision: 0.18729061306361094, recall: 0.1263223039392064,
      confusion: { tp: 8777, fp: 38086, fn: 60704 },
      validation_method: "like-for-like: NISAR new-flood mask vs OPERA DSWx-S1 new flood",
      iou_raw: 0.007528697499424659, f1_raw: 0.014944879521764607,
      precision_raw: 0.1981733990568252, recall_raw: 0.007765240364435442,
      opera_fn_diagnosis: "raw FN 1.19M px = permanent/pre-existing water",
      cloud_pct: 92.89292282546754,
    })!;
    // ratios are never percent-rescaled
    expect(wa.precision).toBe(0.18729061306361094);
    const html = render("validation", bundle({ metricsView: wa }));
    for (const s of [">0.08<", ">0.15<", ">0.19<", ">0.13<", "Precision", "Recall",
      "like-for-like: NISAR new-flood mask", "All water incl. permanent (secondary)",
      "IoU 0.01 · F1 0.01 · P 0.20 · R 0.01", "permanent/pre-existing water",
      "the optical saw only 7%"]) expect(html).toContain(s);
    expect(html).not.toContain("clear-sky reference cells only");
    // no raw keys -> no secondary block
    expect(render("validation", bundle({ metricsView: { iou: 0.5 } }))).not.toContain("All water incl. permanent");
  });

  test("opticalSeenPct accepts 0-1 and 0-100 cloud_pct, never negative", () => {
    expect(opticalSeenPct(0.95)).toBe(5);
    expect(opticalSeenPct(92.89292282546754)).toBe(7);
    expect(opticalSeenPct(100)).toBe(0);
    expect(opticalSeenPct(1)).toBe(0); // normalized 1.0 = 100% cloud
    expect(opticalSeenPct(0)).toBe(100);
    expect(opticalSeenPct(null)).toBeNull();
    expect(opticalSeenPct(-3)).toBeNull();
    expect(opticalSeenPct(250)).toBeNull();
  });

  test("real public/data/metrics.json renders a sane optical % for every case", () => {
    const real = JSON.parse(
      readFileSync(join(import.meta.dir, "../../../public/data/metrics.json"), "utf8")
    ) as { cases: Record<string, Record<string, unknown>> };
    for (const [id, raw] of Object.entries(real.cases)) {
      if (raw.cloud_pct == null) continue;
      const cloud = Number(raw.cloud_pct);
      // metrics.json authors *_pct 0-100 (SCHEMA)
      const expected = Math.round(100 - cloud);
      // normalized path (what getCaseBundle builds)
      const viaView = render("validation", bundle({ id, metricsView: toMetricsView(raw) }));
      expect(viaView).toContain(`the optical saw only ${expected}%`);
      // raw path (un-normalized value must not leak a negative percent)
      const viaRaw = render("validation", bundle({ id, metricsView: { cloud_pct: cloud } }));
      expect(viaRaw).toContain(`the optical saw only ${expected}%`);
      expect(viaRaw).not.toMatch(/saw only -/);
    }
  });

  test("cloud_pct 0.95 renders 'the optical saw only 5%'", () => {
    const html = render("validation", bundle({ metricsView: { cloud_pct: 0.95 } }));
    expect(html).toContain("the optical saw only 5%");
  });

  test("learned vs manual slope rule and integer lead hours", () => {
    const html = render("validation", bundle({ metricsView: FULL_METRICS }));
    expect(html).toContain("learned vs manual slope rule");
    expect(html).toContain("ML model AUC (XGBoost)");
    expect(html).toContain("0.91");
    expect(html).toContain("0.74");
    expect(html).toContain("IQR");
    expect(html).toContain("52 h");
    expect(html).toContain("no cloud pixels");
  });
});

describe("lead-time replay context", () => {
  const metrics = (extra: Record<string, unknown> = {}) => ({
    lead_time_median_h: 30, lead_time_iqr_h: [18, 42], n_points: 12,
    warned_before_pct: 0.8, warned_24h_pct: 0.6, never_critical_pct: 0.2,
    ...extra,
  }) as CaseBundle["metricsView"];

  test("median is contextualized with IQR, sample size and English replay copy", () => {
    const html = render("validation", bundle({ metricsView: metrics({
      official_warning_delta_h: 6, event_lead_h: 24,
      critical_area_with_damage_pct: 0.25, critical_area_km2: 40,
      anchor_precision: "mixed", lead_time_assumptions: { quality: "placeholder" },
    }) }));
    for (const text of ["How early? (in replay)", "Tipping Point would have warned 30 hours earlier",
      "IQR 18–42 h · n = 12", "mixed-precision anchors", "Flagged before damage",
      "Warned &gt;= 24 h early", "Never crossed Critical", "80%", "60%", "20%",
      "vs first official warning: +6 h", "Event-level anchor lead: 24 h",
      "Critical area that had damage: 25%", "40 km²", "Illustrative numbers"]) {
      expect(html).toContain(text);
    }
    expect(html).not.toMatch(/Mediana|antecedência|deslizamentos|Avisados|Crítico/);
    expect(html).not.toContain(">30<");
  });

  test("hours render whole — 47.5 rounds to '48 h', never '47.5'", () => {
    const html = render("validation", bundle({ metricsView: metrics({
      lead_time_median_h: 47.5,
    }) }));
    expect(html).toContain("Tipping Point would have warned 48 hours earlier");
    expect(html).not.toContain("47.5");
  });

  test("absent median renders a pending card; absent optional data stays safe", () => {
    for (const m of [{}, { lead_time_median_h: null }]) {
      const html = render("validation", bundle({ metricsView: m as CaseBundle["metricsView"] }));
      expect(html).toContain("How early? (in replay)");
      expect(html).toContain("Lead-time hindcast pending");
    }
    expect(render("validation", bundle({ metricsView: undefined }))).not.toContain("How early?");
    const html = render("validation", bundle({ metricsView: { lead_time_median_h: 0 } }));
    expect(html).toContain("IQR not reported–not reported h · n = not reported");
    expect(html).toContain("IMERG Early ~4 h");
    expect(html).not.toContain("vs first official warning");
    expect(html).not.toContain("Lead time histogram");
  });

  test("both histogram shapes render and canonical bins preserve negative origins", () => {
    for (const hist of [[{ h_from: -6, n: 2 }, { h_from: 0, n: 5 }],
      { bin_h: 6, from_h: -6, counts: [2, 5] }]) {
      expect(normalizeLeadTimeHist(hist)).toEqual([{ h_from: -6, n: 2 }, { h_from: 0, n: 5 }]);
      expect(render("validation", bundle({ metricsView: metrics({ lead_time_hist: hist }) }))).toContain("Lead time histogram");
    }
    expect(normalizeLeadTimeHist({ bin_h: 6, counts: [1, 2] })).toEqual([{ h_from: 0, n: 1 }, { h_from: 6, n: 2 }]);
    expect(normalizeLeadTimeHist(null)).toEqual([]);
    expect(normalizeLeadTimeHist([{}, { h_from: 0, n: -1 }])).toEqual([]);
  });

  test("timeline places both marker tooltips on the matching tick", () => {
    const html = renderToStaticMarkup(<Timeline dayIndex={0} playing={false} onSeek={noop} onPlayToggle={noop}
      series={{ event: "wa_2025", reference_date: "2025-12-10", days: [{ date: "2025-12-10", offset: 0, kind: "observed", tpi: 0.8, imerg_mm: 10, smap: 0.9 }] }}
      markers={[{ dayIndex: 0, label: "first Critical", color: "amber" }, { dayIndex: 0, label: "first damage", color: "red" }]} />);
    expect(html).toContain('title="first Critical"');
    expect(html).toContain('title="first damage"');
  });
});

describe("radar tab", () => {
  const b = bundle({
    metricsView: FULL_METRICS,
    scars: {
      type: "FeatureCollection",
      features: [scarFeature(), scarFeature(), scarFeature()],
    },
    data_dates: {
      nisar_passes: [
        { date: "2025-11-10", track: "T048", note: "no-event reference" },
        { date: "2025-12-04", track: "T048", note: "pre" },
        { date: "2025-12-16", track: "T048", note: "post" },
      ],
    },
  });

  test("scar count labeled as candidates, never confirmed", () => {
    const html = render("radar", b);
    expect(html).toContain("candidates");
    expect(html).toContain(">3<");
  });

  test("renders nisar_passes from data_dates", () => {
    const html = render("radar", b);
    expect(html).toContain("no-event reference");
    expect(html).toContain("post");
  });
});

describe("fmtBrt date-only handling", () => {
  test("date-only '2026-11-11' renders the same day, not shifted back", () => {
    expect(fmtBrt("2026-11-11")).toContain("Nov 11");
    expect(fmtBrt("2026-11-11")).not.toContain("Nov 10");
  });
});

describe("radar tab NISAR gating", () => {
  test("swath scope renders whole coverage for either flooded card and either percent scale", () => {
    for (const data_dates of [{ nisar_pre: null, nisar_post: null }, { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" }]) {
      for (const swath_coverage_pct of [0.426, 42.6]) {
        const html = render("radar", bundle({ data_dates, metricsView: {
          flooded_km2: 41.6, flooded_km2_scope: "within NISAR swath", swath_coverage_pct,
        } as CaseBundle["metricsView"] }));
        expect(html).toContain("within the NISAR swath — 43% of the area covered");
      }
    }
  });

  test("swath coverage stays hidden without scope, finite coverage, or a flooded card", () => {
    for (const extra of [{}, { swath_coverage_pct: 0.4 },
      { flooded_km2_scope: "within NISAR swath" },
      { flooded_km2_scope: "within NISAR swath", swath_coverage_pct: NaN },
      { flooded_km2_scope: "within NISAR swath", swath_coverage_pct: Infinity },
      { flooded_km2_scope: "within NISAR swath", swath_coverage_pct: "40" },
      { flooded_km2_scope: "within NISAR swath", swath_coverage_pct: 0.4, flooded_km2: undefined }]) {
      expect(render("radar", bundle({ metricsView: { flooded_km2: 41.6, ...extra } as CaseBundle["metricsView"] })))
        .not.toContain("of the area covered");
    }
  });

  test("replay without a pair: observed reference card, no NISAR label", () => {
    const html = render(
      "radar",
      bundle({
        metricsView: { flooded_km2: 118.3 },
        data_dates: { nisar_pre: null, nisar_post: null },
      })
    );
    expect(html).not.toContain("Flooded area (NISAR)");
    expect(html).toContain("No radar for this event (before NISAR launch).");
    expect(html).not.toContain("optical/observed reference is shown");
    expect(html).toContain("Flooded area (observed reference)");
    expect(html).toContain("118.3 km");
  });

  test("the GUNW-limitation paragraph only renders when a NISAR pair exists", () => {
    const withoutPair = render(
      "radar",
      bundle({
        metricsView: { flooded_km2: 118.3 },
        data_dates: { nisar_pre: null, nisar_post: null },
      })
    );
    expect(withoutPair).not.toContain("declared limitation");
    expect(withoutPair).not.toContain("GUNW pair spanning");

    const withPair = render(
      "radar",
      bundle({
        metricsView: { flooded_km2: 41.6 },
        data_dates: { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" },
      })
    );
    expect(withPair).toContain("declared limitation");
  });

  test("flood_source 'opera' labels the card optical/OPERA", () => {
    const html = render(
      "radar",
      bundle({
        metricsView: {
          flooded_km2: 118.3,
          flood_source: "opera",
        } as CaseBundle["metricsView"],
        data_dates: { nisar_pre: null, nisar_post: null },
      })
    );
    expect(html).toContain("Flooded area (optical/OPERA reference)");
    expect(html).not.toContain("Flooded area (NISAR)");
  });

  test("a data_dates pair shows the NISAR card and the date line", () => {
    const html = render(
      "radar",
      bundle({
        metricsView: { flooded_km2: 41.6 },
        data_dates: { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" },
      })
    );
    expect(html).toContain("Flooded area (NISAR)");
    expect(html).toContain("Dec 4, 2025");
    expect(html).not.toContain("No radar for this event");
  });

  test("live case without a pair keeps the awaiting copy", () => {
    const html = render("radar", bundle({ mode: "live" }));
    expect(html).toContain("Awaiting a NISAR pair over the AOI.");
    expect(html).not.toContain("No radar for this event");
  });
});

describe("banned strings", () => {
  test("no 'confirmed scar/landslide' and no 'WorldPop' in any tab", () => {
    const b = bundle({
      metricsView: FULL_METRICS,
      scars: { type: "FeatureCollection", features: [scarFeature()] },
    });
    for (const tab of ["alert", "radar", "validation", "impact"] as const) {
      const html = render(tab, b);
      expect(html).not.toMatch(/confirmed (scar|landslide)/i);
      expect(html).not.toContain("WorldPop");
    }
  });
});

describe("alert tab 'Data pending' marker", () => {
  test("hidden when metricsView is present", () => {
    const html = render("alert", bundle({ metricsView: FULL_METRICS }));
    expect(html).not.toContain("pending.");
    expect(html).not.toContain("Illustrative");
  });

  test("hidden when a live summary is present", () => {
    const html = render(
      "alert",
      bundle({ mode: "live", summary: { people_critical: 1200 } })
    );
    expect(html).not.toContain(">pending.");
    expect(html).not.toContain("Illustrative");
  });

  test("shown when the bundle is mock-derived (no metricsView and no summary)", () => {
    // Needs a series so the stat row renders — the marker lives inside it.
    const html = render("alert", bundle({ series: {
      event: "wa_2025", reference_date: "2025-12-10", tpi_threshold: 0.75,
      days: [{ date: "2025-12-10", offset: 0, kind: "observed", tpi: 0.5, imerg_mm: 1, smap: 0.5 }],
    } }));
    expect(html).toContain("pending.");
    expect(html).not.toContain("Illustrative");
  });

  test("a fallback bundle is real last-saved data — no pending marker", () => {
    const flagged = bundle({ series: {
      event: "wa_2025", reference_date: "2025-12-10", tpi_threshold: 0.75,
      days: [{ date: "2025-12-10", offset: 0, kind: "observed", tpi: 0.5, imerg_mm: 1, smap: 0.5 }],
    }, metricsView: FULL_METRICS });
    (flagged as CaseBundle & { fallback?: boolean }).fallback = true;
    const html = render("alert", flagged);
    expect(html).not.toContain("pending.");
    expect(html).not.toContain("Illustrative");
  });

  test("forecast_source badge renders the contract label on forecast days only", () => {
    // Observed day: no forecast chip, even when the manifest declares a
    // forecast_source (rule 2 — EVENT day must not read "perfect forecast").
    const observed = render(
      "alert",
      bundle({
        metricsView: FULL_METRICS,
        manifest: {
          event: "wa_2025",
          layers: [],
          forecast_source: "perfect-forecast",
        },
      })
    );
    expect(observed).not.toContain("perfect forecast");

    const fcast = bundle({
      metricsView: FULL_METRICS,
      manifest: {
        event: "wa_2025",
        layers: [],
        forecast_source: "perfect-forecast",
      },
      series: {
        event: "wa_2025",
        reference_date: "2025-12-10",
        days: [
          { date: "2025-12-10", offset: 0, kind: "observed", tpi: 0.5, imerg_mm: 1, smap: 0.5 },
          { date: "2025-12-11", offset: 1, kind: "forecast", tpi: 0.5, imerg_mm: 1, smap: 0.5 },
        ],
      },
    });
    // dayIndex defaults to the first day (observed); render with the
    // forecast day selected via the timeline prop.
    const forecast = render("alert", fcast, 1);
    expect(forecast).toContain("forecast · perfect");

    const live = render(
      "alert",
      bundle({
        mode: "live",
        summary: { forecast_source: "geos-fp" },
        series: fcast.series,
      }),
      1
    );
    expect(live).toContain("forecast · GEOS-FP");
  });

  // L22: a real issued GFS frame on the forecast day names its issue date;
  // perfect-forecast frames on the same date never win the headline.
  test("GFS frame on a forecast day: chip reads 'forecast · GFS (issued <date>)'", () => {
    const gfsLayer = (k: number, date: string, issued: string) => ({
      id: `tpi_flood_gfs_d${k}`, date, png: `rs_2024/png/tpi_flood_gfs_d${k}_${date.replaceAll("-", "")}.png`,
      forecast: true, issued, forecast_source: "noaa-gfs", kind: "forecast",
    });
    const b = bundle({
      metricsView: FULL_METRICS,
      reference_date: "2024-05-02",
      manifest: {
        event: "rs_2024",
        forecast_source: "perfect-forecast",
        layers: [
          { id: "tpi_flood", date: "2024-05-03", png: "rs_2024/png/tpi_flood_20240503.png", forecast: false },
          { id: "tpi_flood_d1", date: "2024-05-03", png: "rs_2024/png/tpi_flood_d1_20240503.png", forecast: true, forecast_source: "perfect-forecast", upper_bound: true },
          gfsLayer(1, "2024-05-03", "2024-05-02"),
          gfsLayer(2, "2024-05-03", "2024-05-01"),
          // issued after the anchor day: must not be picked
          gfsLayer(1, "2024-05-04", "2024-05-03"),
        ],
      },
      series: {
        event: "rs_2024",
        reference_date: "2024-05-02",
        days: [
          { date: "2024-05-02", offset: 0, kind: "observed", tpi: 0.5, imerg_mm: 1, smap: 0.5 },
          { date: "2024-05-03", offset: 1, kind: "forecast", tpi: 0.5, imerg_mm: 1, smap: 0.5 },
          { date: "2024-05-04", offset: 2, kind: "forecast", tpi: 0.5, imerg_mm: 1, smap: 0.5 },
        ],
      },
    });
    expect(render("alert", b, 1)).toContain("forecast · GFS (issued May 2, 2024)");
    expect(render("alert", b, 1)).not.toContain("forecast · perfect");
    // 05-04 only has a GFS frame issued after the anchor -> never shown;
    // the chip falls back to the case source.
    expect(render("alert", b, 2)).toContain("forecast · perfect");
    expect(pickTpiFrame(b.manifest!.layers, b.series!.days[2], "flood", "2024-05-02")).toBeUndefined();
    expect(render("alert", b, 0)).not.toContain("forecast ·");

    const day1 = b.series!.days[1];
    const f = pickTpiFrame(b.manifest!.layers, day1, "flood", "2024-05-02");
    expect(f?.id).toBe("tpi_flood_gfs_d1");
    expect(f?.issued).toBe("2024-05-02");
    // observed day: the observed frame wins even when a GFS frame shares the date
    const obs = pickTpiFrame(b.manifest!.layers, { date: "2024-05-03", kind: "observed" }, "flood", "2024-05-02");
    expect(obs?.id).toBe("tpi_flood");
    expect(forecastChip(f, "perfect forecast")).toBe("forecast · GFS (issued May 2, 2024)");
    expect(forecastChip(undefined, "GEOS-FP")).toBe("forecast · GEOS-FP");
  });
});

describe("pending states (L14)", () => {
  const withPending = (b: CaseBundle, tokens: string[]): CaseBundle =>
    ({ ...b, pending: tokens }) as CaseBundle;

  const oneSeries = {
    event: "wa_2025", reference_date: "2025-12-10", tpi_threshold: 0.75,
    days: [{ date: "2025-12-10", offset: 0, kind: "observed", tpi: 0.5, imerg_mm: 1, smap: 0.5 }],
  } as CaseBundle["series"];

  test("alert tab: no series and no zones renders neutral MONITORING PENDING", () => {
    const html = render("alert", bundle());
    expect(html).toContain("MONITORING PENDING");
    expect(html).toContain("pipeline has not produced a TPI series or monitored zones");
    expect(html).not.toContain("TIPPING POINT WATCH");
    expect(html).not.toContain("TIPPING POINT REACHED");
    // No zeros masquerading as data — the critical/people stat row is hidden.
    expect(html).not.toContain("people exposed");
    expect(html).toContain("Pending — no monitored zones for this case.");
  });

  test("alert tab: pending tokens 'series'/'priority_zones' force the neutral banner", () => {
    const html = render("alert", withPending(bundle({ series: oneSeries }), ["series"]));
    expect(html).toContain("MONITORING PENDING");
    const zoned = render("alert", withPending(bundle({ series: oneSeries }), ["priority_zones"]));
    expect(zoned).toContain("MONITORING PENDING");
    // A real series without the token still renders WATCH.
    expect(render("alert", bundle({ series: oneSeries }))).toContain("TIPPING POINT WATCH");
  });

  test("impact tab: pending card when metricsView is absent, basis box stays", () => {
    const html = render("impact", bundle());
    expect(html).toContain("Impact metrics pending");
    expect(html).toContain("none published yet");
    expect(html).toContain("Exposure basis");
    expect(html).not.toContain("People flooded");
    // Real values still render.
    const real = render("impact", bundle({ metricsView: FULL_METRICS }));
    expect(real).toContain("8,400");
    expect(real).toContain("41.6 km²");
    expect(real).not.toContain(">pending<");
  });

  test("impact tab: pending token 'metrics' forces the pending card", () => {
    const html = render("impact", withPending(bundle({ metricsView: FULL_METRICS }), ["metrics"]));
    expect(html).toContain("Impact metrics pending");
    expect(html).not.toContain("8,400");
  });

  test("validation tab: per-field pending cells plus real values", () => {
    const html = render("validation", bundle({ metricsView: { iou: 0.5 } }));
    expect(html).toContain(">0.50<");
    expect(html).toContain(">pending<");
    // The pending token also triggers the whole-section pending card.
    const tok = render("validation", withPending(bundle({ metricsView: FULL_METRICS }), ["metrics"]));
    expect(tok).toContain("No validation metrics yet");
  });

  test("radar tab: NISAR pair without flooded_km2 renders a pending flood card", () => {
    const html = render("radar", bundle({
      metricsView: {},
      data_dates: { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" },
    }));
    expect(html).toContain("Flooded area (NISAR)");
    expect(html).toContain(">pending<");
    // No pair and no flooded value: the card stays hidden (dashed box explains).
    const noPair = render("radar", bundle({ metricsView: {} }));
    expect(noPair).not.toContain("Flooded area");
  });

  test("radar tab: scars absent is pending, empty scars is a real zero", () => {
    const absentHtml = render("radar", bundle({ metricsView: {} }));
    expect(absentHtml).toContain(">pending<");
    const zero = render("radar", bundle({
      metricsView: {},
      scars: { type: "FeatureCollection", features: [] },
    }));
    expect(zero).toContain(">0<");
    const tok = render("radar", withPending(bundle({
      metricsView: {},
      scars: { type: "FeatureCollection", features: [scarFeature()] },
    }), ["landslide_candidates"]));
    expect(tok).toContain(">pending<");
    expect(tok).not.toContain(">1<");
  });

  test("agora card: absent or pending-flagged summary renders pending rows", () => {
    const html = render("alert", bundle({ mode: "live" }));
    expect(html).toContain("Live summary pending — awaiting the current run");
    for (const label of ["IMERG Early — rain", "SMAP L4 — soil moisture", "GEOS-FP — forecast"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain(">pending<");
    const tok = render("alert", withPending(
      bundle({ mode: "live", summary: { people_critical: 1200 } }),
      ["summary"]
    ));
    expect(tok).toContain("Live summary pending");
    expect(tok).not.toContain("1,200");
  });

  test("validation tab: lead-time pending card when median is absent", () => {
    const html = render("validation", bundle({ metricsView: { iou: 0.5 } }));
    expect(html).toContain("Lead-time hindcast pending");
    // Real values still render.
    expect(render("validation", bundle({ metricsView: FULL_METRICS }))).toContain("warned 52 hours earlier");
  });
});
