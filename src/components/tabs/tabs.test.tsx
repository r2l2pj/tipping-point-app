// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { CaseBundle } from "../../lib/types";
import SidePanel, { type TabKey } from "../SidePanel";
import { normalizeLeadTimeHist } from "../charts/LeadTimeHistogram";
import Timeline from "../Timeline";
import { fmtBrt } from "./format";
import { cutsFor, tpiClass } from "../../lib/tpi";
import { fmtDate } from "../../lib/layers";

const noop = () => {};

const bundle = (over: Partial<CaseBundle> = {}): CaseBundle => ({
  id: "wa_2025",
  title: "WA 2025",
  mode: "replay",
  bbox: [-122.6, 47.0, -121.5, 48.5],
  reference_date: "2025-12-10",
  ...over,
});

const render = (tab: TabKey, b: CaseBundle, dayIndex = 0) =>
  renderToStaticMarkup(
    <SidePanel
      tab={tab}
      onTab={noop}
      bundle={b}
      zones={[]}
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
    expect(render("alert", bundle())).toContain("TIPPING POINT WATCH");
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
    for (const text of ["How early? (in replay)", "Median 30 h before mapped landslides",
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
    expect(html).toContain("Median 48 h before mapped landslides");
    expect(html).not.toContain("47.5");
  });

  test("absent metrics or median hide the card; absent optional data stays safe", () => {
    for (const m of [undefined, {}, { lead_time_median_h: null }]) {
      expect(render("validation", bundle({ metricsView: m as CaseBundle["metricsView"] }))).not.toContain("How early?");
    }
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

describe("alert tab 'Illustrative demo data' marker", () => {
  test("hidden when metricsView is present", () => {
    const html = render("alert", bundle({ metricsView: FULL_METRICS }));
    expect(html).not.toContain("Illustrative");
  });

  test("hidden when a live summary is present", () => {
    const html = render(
      "alert",
      bundle({ mode: "live", summary: { people_critical: 1200 } })
    );
    expect(html).not.toContain("Illustrative");
  });

  test("shown only when the bundle is mock-derived", () => {
    expect(render("alert", bundle())).toContain("Illustrative");
    const flagged = bundle();
    (flagged as CaseBundle & { fallback?: boolean }).fallback = true;
    expect(render("alert", flagged)).toContain("Illustrative");
  });

  test("forecast_source badge renders the contract label", () => {
    const replay = render(
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
    expect(replay).toContain("perfect forecast");

    const live = render(
      "alert",
      bundle({ mode: "live", summary: { forecast_source: "geos-fp" } })
    );
    expect(live).toContain("GEOS-FP");
  });
});
