// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { CaseBundle } from "../../lib/types";
import SidePanel, { type TabKey } from "../SidePanel";

const noop = () => {};

const bundle = (over: Partial<CaseBundle> = {}): CaseBundle => ({
  id: "wa_2025",
  title: "WA 2025",
  mode: "replay",
  bbox: [-122.6, 47.0, -121.5, 48.5],
  reference_date: "2025-12-10",
  ...over,
});

const render = (tab: TabKey, b: CaseBundle) =>
  renderToStaticMarkup(
    <SidePanel
      tab={tab}
      onTab={noop}
      bundle={b}
      zones={[]}
      dayIndex={0}
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

describe("validation tab on metricsView", () => {
  test("cloud_pct 0.95 renders 'the optical saw only 5%'", () => {
    const html = render("validation", bundle({ metricsView: { cloud_pct: 0.95 } }));
    expect(html).toContain("the optical saw only 5%");
  });

  test("learned vs manual slope rule and integer lead hours", () => {
    const html = render("validation", bundle({ metricsView: FULL_METRICS }));
    expect(html).toContain("learned vs manual slope rule");
    expect(html).toContain("0.91");
    expect(html).toContain("0.74");
    expect(html).toContain("48 h");
    expect(html).toContain("52 h");
    expect(html).toContain("no cloud pixels");
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
    expect(html).toContain("No radar for this event (before NISAR launch)");
    expect(html).toContain("Flooded area (observed reference)");
    expect(html).toContain("118.3 km");
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
