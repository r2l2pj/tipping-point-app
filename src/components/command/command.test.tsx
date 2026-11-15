// Rule assertions of test_parity_checklist.md, re-pointed at the new screen:
// the test renders the new root over bundle fixtures and checks the same
// strings the old tabs.test.tsx checked through SidePanel and Timeline.
// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { AreaCard } from "./AreaCallout";
import { normalizeLeadTimeHist } from "./charts/LeadTimeHistogram";
import { CommandCenterView } from "./CommandCenter";
import type { AlertList } from "./model/alerts";
import { buildAlertList } from "./model/alerts";
import { priorityAreas } from "./model/areas";
import { bundle, liveBundle, manifest, point, series, zone, zones } from "./model/fixtures";
import type { CcBundle } from "./model/types";
import type { ScreenState } from "./state";

const noop = () => {};
const UNAVAILABLE: AlertList = { state: "unavailable", alerts: [] };

const render = (
  b: CcBundle | CcBundle[],
  initial: Partial<ScreenState> = {},
  view: "command" | "public" = "command",
  alertList: AlertList = UNAVAILABLE,
  botUrl?: string
) =>
  renderToStaticMarkup(
    <CommandCenterView
      cases={Array.isArray(b) ? b : [b]}
      alertList={alertList}
      botUrl={botUrl}
      view={view}
      onView={noop}
      initial={initial}
    />
  );

// The panel with the evidence details open (old Validation and Impact tabs).
const details = (b: CcBundle) => render(b, { detailsOpen: true });
const mv = (m: Record<string, unknown>) => m as CcBundle["metricsView"];

const WA_LEAD = JSON.parse(readFileSync(join(process.cwd(), "test/fixtures/lead/forecast_lead_time_wa_2025.json"), "utf8"));
const RS_LEAD = JSON.parse(readFileSync(join(process.cwd(), "test/fixtures/lead/forecast_lead_time_rs_2024.json"), "utf8"));

const FULL_METRICS = mv({
  iou: 0.71, f1: 0.83, cloud_pct: 0.95, landslide_hit_pct: 0.62, hand_validation: 0.78,
  people_critical: 8400, people_flooded: 2100, flooded_km2: 41.6, night_light_drop_pct: 0.18,
  lead_time_mean_h: 47.5, lead_time_median_h: 52, lead_time_iqr_h: [30, 70], lead_time_n: 9, warned_before_pct: 0.87,
  rf_auc: 0.91, rule_auc: 0.74,
  feature_importance: { imerg_p95_mm: 0.41, smap_l4: 0.33, nasadem_slope: 0.26 },
  forecast_source: "perfect-forecast",
});

describe("status chip and contract values (S1, L9)", () => {
  const replay = bundle({ series: series([0.7, 0.75, 0.4], [], 0.75) });

  test("reached follows the selected day, including equality and rewinding", () => {
    for (const dayIndex of [0, 2, 0]) {
      const html = render(replay, { dayIndex });
      expect(html).not.toContain("Tipping point reached");
      expect(html).toContain("Below the tipping point");
    }
    expect(render(replay, { dayIndex: 1 })).toContain("Tipping point reached");
    expect(render(bundle())).toContain("No data for this event");
    expect(render(bundle())).not.toContain("Tipping point reached");
  });

  test("class cuts supply the threshold when the series has none", () => {
    const b = { ...replay, classCuts: [0.1, 0.3, 0.8], series: { ...replay.series!, tpi_threshold: undefined } };
    const html = render(b, { dayIndex: 1 });
    expect(html).not.toContain("Tipping point reached");
    expect(html).toContain("threshold 0.80");
    expect(html).toContain("TPI threshold (0.80)");
  });

  test("the legend takes its cuts from the bundle, then the manifest, then the defaults", () => {
    expect(render(bundle())).toContain("Critical (0.60 or more)");
    const cut = { ...bundle(), classCuts: [0.1, 0.3, 0.8], manifest: manifest([], { tpi_cuts: [0.2, 0.5, 0.9] }) };
    expect(render(cut)).toContain("Critical (0.80 or more)");
    expect(render(bundle({ manifest: manifest([], { tpi_cuts: [0.2, 0.5, 0.9] }) }))).toContain("High (0.50 to below 0.90)");
  });

  test("dates render in BRT; a date-only value keeps its day", () => {
    const html = render(bundle({ data_dates: { imerg: "2026-11-11", smap: "2026-11-11T01:00:00Z" } }));
    expect(html).toContain("Nov 11, 2026");
    expect(html).toContain("Nov 10, 10:00 PM BRT");
  });

  test("the forecast source label of the contract is shown (T4, S1)", () => {
    const replayHtml = render(bundle({
      metricsView: FULL_METRICS,
      series: series([0.2, 0.9], ["observed", "forecast"]),
      manifest: manifest([], { forecast_source: "perfect-forecast" }),
    }));
    expect(replayHtml).toContain("Forecast (perfect forecast · upper bound)"); // never the bare source (L22)
    expect(replayHtml).not.toContain("GEOS-FP)");
    // Rule 2: an observed day (the event day too) reads "observed"; the
    // forecast source is named on forecast days only.
    expect(replayHtml).toContain("Step: Dec 10 (EVENT) · observed");
    const forecastDay = render(bundle({
      series: series([0.2, 0.9], ["observed", "forecast"]),
      manifest: manifest([], { forecast_source: "perfect-forecast" }),
    }), { dayIndex: 1 });
    expect(forecastDay).toContain("Step: Dec 11 (D+1) · forecast · perfect forecast");
    const live = render(liveBundle({
      summary: { forecast_source: "geos-fp" },
      series: series([0.2, 0.9], ["observed", "forecast"]),
    }), { dayIndex: 1 });
    expect(live).toContain("forecast · older forecast run");
    expect(live).not.toContain("GEOS");
  });
});

describe("replay check and evidence details (S17, S18, S19)", () => {
  test("cloud_pct 0.95 renders 'the optical saw only 5%'", () => {
    expect(details(bundle({ metricsView: mv({ cloud_pct: 0.95 }) }))).toContain("the optical saw only 5%");
  });

  test("learned vs manual slope rule and integer lead hours", () => {
    const html = details(bundle({ metricsView: FULL_METRICS, forecastLeadTime: WA_LEAD }));
    for (const text of ["learned vs manual slope rule", "ML model AUC (XGBoost)", "Manual slope-rule AUC",
      "0.91", "0.74", "IQR 55–115 h", "85 h", "no cloud pixels"]) {
      expect(html).toContain(text);
    }
  });

  test("WA: the card and the row carry the submission headline words", () => {
    const html = details(bundle({ metricsView: mv({ critical_area_with_damage_pct: 0.25, critical_area_km2: 40 }),
      forecastLeadTime: WA_LEAD }));
    for (const text of ["How early? (in replay)",
      "Using the forecast available at the time: median 85 h (IQR 55–115 h, 6 of 8 forecast days)",
      "Lead time before the damage (NOAA GFS forecast replay)",
      "Earliest forecast run that flagged it: Dec 3, 2025 (00Z)", "Damage anchor: Dec 9, 2025 00:35 UTC",
      "Critical area that had damage: 25%", "40 km²"]) {
      expect(html).toContain(text);
    }
    expect(html).not.toMatch(/Mediana|antecedência|deslizamentos|Avisados|Crítico/);
    // "% warned first" was dropped (Lucas, 2026-11-15): never shown.
    expect(html).not.toContain("Flagged before damage");
    expect(html).not.toContain("Zones warned before the event");
    expect(html).not.toContain("84.6");
    expect(html).not.toContain("would have warned");
  });

  test("RS: one flagging forecast day, never a median", () => {
    const html = details(bundle({ id: "rs_2024", metricsView: mv({}), forecastLeadTime: RS_LEAD }));
    expect(html).toContain("1 of 4 forecast days flagged it, 111 h ahead");
    expect(html).not.toMatch(/median 111|Median 111/);
  });

  test("no median or no n: the row and the card read 'pending: forecast rebuild'; no metrics hides the card", () => {
    // Never a stat without n: a median with n missing (the real RS metrics:
    // median -57 h, IQR -57–-57, n null) is pending too.
    for (const m of [{}, { lead_time_median_h: null },
      { lead_time_median_h: -57, lead_time_iqr_h: [-57, -57], lead_time_n: null },
      { lead_time_median_h: -57, lead_time_iqr_h: [-57, -57], lead_time_n: 5678 },
      { lead_time_median_h: 0 }]) {
      const html = details(bundle({ metricsView: mv(m as never) }));
      expect(html).toContain("How early? (in replay)");
      expect(html).toContain("Lead time: pending: forecast rebuild.");
      expect(html).toMatch(/data-check="lead-time".*?pending: forecast rebuild/);
      expect(html).not.toContain("-57");
      expect(html).not.toContain("n = not reported");
    }
    const none = details(bundle({ metricsView: undefined }));
    expect(none).not.toContain("How early?");
    expect(none).toMatch(/data-check="lead-time".*?pending: forecast rebuild/);
  });

  test("both histogram shapes normalize", () => {
    for (const hist of [[{ h_from: -6, n: 2 }, { h_from: 0, n: 5 }], { bin_h: 6, from_h: -6, counts: [2, 5] }]) {
      expect(normalizeLeadTimeHist(hist)).toEqual([{ h_from: -6, n: 2 }, { h_from: 0, n: 5 }]);
    }
    expect(normalizeLeadTimeHist(null)).toEqual([]);
  });

  test("the card is not shown in Now", () => {
    expect(render(liveBundle())).not.toContain("Replay check");
  });
});

describe("timeline (T5)", () => {
  test("both marks sit on the matching step", () => {
    const html = render(bundle({
      series: series([0.8]),
      metricsView: mv({ damage_anchor: { at: "2025-12-10" } }),
    }));
    expect(html).toContain('title="first Critical"');
    expect(html).toContain('title="first damage"');
  });

  test("a case with no frames reads 'No frames published yet'", () => {
    expect(render(liveBundle())).toContain("No frames published yet");
  });
});

describe("radar card (S13, L6, L7, L11)", () => {
  const b = bundle({
    metricsView: FULL_METRICS,
    scars: { type: "FeatureCollection", features: [point(), point(), point()] },
    data_dates: { nisar_passes: [
      { date: "2025-11-10", track: "T048", note: "no-event reference" },
      { date: "2025-12-04", track: "T048", note: "pre" },
      { date: "2025-12-16", track: "T048", note: "post" },
    ] },
  });

  test("scar count labeled as candidates, never confirmed", () => {
    const html = render(b);
    expect(html).toContain("Landslide scar candidates (OPERA DIST-ALERT-HLS, vegetation loss)");
    expect(html).toContain("candidates, never confirmed");
    expect(html).toContain(">3<");
  });

  test("renders nisar_passes from data_dates", () => {
    const html = render(b);
    expect(html).toContain("no-event reference");
    expect(html).toContain("Nov 10, 2025 · track T048");
  });

  test("swath scope renders whole coverage on either percent scale", () => {
    for (const data_dates of [{ nisar_pre: null, nisar_post: null }, { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" }]) {
      for (const swath_coverage_pct of [0.426, 42.6]) {
        const html = render(bundle({ data_dates, metricsView: mv({
          flooded_km2: 41.6, flooded_km2_scope: "within NISAR swath", swath_coverage_pct,
        }) }));
        expect(html).toContain("within the NISAR swath — 43% of the area covered");
      }
    }
  });

  test("swath coverage stays hidden without scope, finite coverage, or a flooded value", () => {
    for (const extra of [{}, { swath_coverage_pct: 0.4 }, { flooded_km2_scope: "within NISAR swath" },
      { flooded_km2_scope: "within NISAR swath", swath_coverage_pct: NaN },
      { flooded_km2_scope: "within NISAR swath", swath_coverage_pct: Infinity },
      { flooded_km2_scope: "within NISAR swath", swath_coverage_pct: "40" },
      { flooded_km2_scope: "within NISAR swath", swath_coverage_pct: 0.4, flooded_km2: undefined }]) {
      expect(render(bundle({ metricsView: mv({ flooded_km2: 41.6, ...extra }) }))).not.toContain("of the area covered");
    }
  });

  test("replay without a pair: observed reference, no NISAR label", () => {
    const html = render(bundle({
      metricsView: mv({ flooded_km2: 118.3 }),
      data_dates: { nisar_pre: null, nisar_post: null },
    }));
    expect(html).not.toContain("Flooded area (NISAR)");
    expect(html).not.toContain("Flood confirmed by radar (NISAR)");
    expect(html).not.toContain("Check with NISAR radar");
    expect(html).toContain("No radar for this event (before NISAR launch).");
    expect(html).toContain("Flooded area (observed reference)");
    expect(html).toContain("118.3 km");
  });

  test("the GUNW-limitation paragraph only renders when a NISAR pair exists", () => {
    const withoutPair = render(bundle({ metricsView: mv({ flooded_km2: 118.3 }), data_dates: { nisar_pre: null, nisar_post: null } }));
    expect(withoutPair).not.toContain("declared limitation");
    expect(withoutPair).not.toContain("GUNW pair spanning");
    const withPair = render(bundle({ metricsView: mv({ flooded_km2: 41.6 }), data_dates: { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" } }));
    expect(withPair).toContain("declared limitation");
  });

  test("flood_source 'opera' labels the value optical/OPERA", () => {
    const html = render(bundle({
      metricsView: mv({ flooded_km2: 118.3, flood_source: "opera" }),
      data_dates: { nisar_pre: null, nisar_post: null },
    }));
    expect(html).toContain("Flooded area (optical/OPERA reference)");
    expect(html).toContain("Flood reference (optical/OPERA)");
    expect(html).not.toContain("Flooded area (NISAR)");
  });

  test("a data_dates pair shows the NISAR label and the pass dates", () => {
    const html = render(bundle({
      metricsView: mv({ flooded_km2: 41.6 }),
      data_dates: { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" },
    }));
    expect(html).toContain("Flooded area (NISAR)");
    expect(html).toContain("Dec 4, 2025 → Dec 16, 2025");
    expect(html).toContain("NISAR passes: Dec 4, 2025, Dec 16, 2025");
    expect(html).not.toContain("No radar for this event");
  });

  test("live case without a pair keeps the awaiting copy", () => {
    const html = render(liveBundle());
    expect(html).toContain("Awaiting a NISAR pair over the AOI.");
    expect(html).not.toContain("No radar for this event");
  });

  test("'Before / after' is disabled with its reason while the images are missing", () => {
    const html = render(bundle({ data_dates: { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" } }));
    expect(html).toContain("Before / after: images not published yet");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Before \/ after<\/button>/);
  });
});

describe("banned strings, both views", () => {
  test("no 'confirmed scar/landslide' and no 'WorldPop'", () => {
    const b = bundle({
      metricsView: FULL_METRICS,
      series: series([0.2, 0.9]),
      scars: { type: "FeatureCollection", features: [point()] },
      zones: zones([zone(1), zone(2)]),
      data_dates: { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" },
    });
    const alerts = buildAlertList({ now: liveBundle({ updated_at: "2026-11-14T15:00:00Z",
      nowAlerts: { candidates: [{ class: 3, label: "landslide", pixels: 80 }] } }) });
    for (const html of [
      render(b, { detailsOpen: true, layers: ["flood", "candidates"], listExpanded: true, chartAsTable: true }),
      render(b, {}, "public"),
      render(liveBundle(), {}, "public", alerts),
      render(liveBundle(), {}, "command"),
    ]) {
      expect(html).not.toMatch(/confirmed (scar|landslide)/i);
      expect(html).not.toContain("WorldPop");
    }
  });
});

describe("response-first section order (L27)", () => {
  const b = bundle({
    series: series([0.9]),
    metricsView: mv({ flooded_km2: 41.6, people_critical: 8400 }),
    data_dates: { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" },
    manifest: {
      event: "wa_2025",
      layers: [{ id: "p_trigger_24h", date: "2025-12-10", png: "wa_2025/png/p_trigger_24h_20251210.png" }],
    },
  });

  test("the probability pointer shows only when the case publishes P(trigger) frames", () => {
    const pointer = "Model probabilities (24 h–14 d) are in the Layers column.";
    expect(render(b)).toContain(pointer);
    expect(render({ ...b, manifest: { event: "wa_2025", layers: [] } })).not.toContain(pointer);
  });

  test("Now on the ground precedes Prediction; ground facts precede the TPI chip", () => {
    const html = render(b);
    const at = (s: string) => html.indexOf(s);
    // The response section opens the panel.
    expect(at("Now on the ground")).toBeGreaterThanOrEqual(0);
    expect(at("Prediction")).toBeGreaterThan(at("Now on the ground"));
    // What is flooded/sliding and who is exposed come before the TPI chip.
    for (const s of ["Radar check", "Flooded area (NISAR)", "Who is affected", "People potentially exposed", "Priority areas"]) {
      expect(at(s)).toBeGreaterThanOrEqual(0);
      expect(at(s)).toBeLessThan(at("Tipping point reached"));
    }
    // Inside Prediction: the chip stays the headline, then the chart, then
    // the pointer to the probability horizons in the Layers column.
    expect(at("Tipping point reached")).toBeGreaterThan(at("Prediction"));
    expect(at("Rain, Soil Moisture and TPI")).toBeGreaterThan(at("Tipping point reached"));
    expect(at("Model probabilities (24 h–14 d) are in the Layers column.")).toBeGreaterThan(at("Rain, Soil Moisture and TPI"));
    // Replay check and the source ages keep their place at the end.
    expect(at("Replay check")).toBeGreaterThan(at("Prediction"));
    expect(at("Data sources - dates in BRT")).toBeGreaterThan(at("Replay check"));
  });

  test("the sections belong to the command view only", () => {
    const html = render(b, {}, "public");
    expect(html).not.toContain("Now on the ground");
    expect(html).not.toContain(">Prediction<");
  });
});

describe("data status (M2, S23)", () => {
  const shown = { series: series([0.2]) };

  // main removed the "Illustrative demo data" marker: a fallback bundle is
  // real last-saved data. The label is never shown.
  test("'Illustrative demo data' is never shown", () => {
    for (const b of [
      bundle({ metricsView: FULL_METRICS, ...shown }),
      liveBundle({ summary: { people_critical: 1200 } }),
      bundle({ fallback: true, metricsView: FULL_METRICS, ...shown }),
      bundle({ fallback: true, ...shown }),
      bundle(shown),
    ]) {
      expect(render(b)).not.toContain("Illustrative");
    }
  });

  test("a bundle with neither metrics nor a summary reads 'not published yet'", () => {
    const html = render(bundle(shown));
    expect(html).toContain("not published yet");
    expect(html).not.toContain("0.0 km²");
  });

  test("last saved data shows its date and is not called illustrative", () => {
    const html = render(bundle({ fallback: true, metricsView: FULL_METRICS, updated_at: "2026-11-14T15:00:00Z" }));
    expect(html).toContain("Showing last saved data from Nov 14, 12:00 PM BRT");
    expect(html).toContain("Last saved data");
  });

  test("a live run is never 'live' without a checked age", () => {
    const html = render(liveBundle({ updated_at: "2026-11-14T15:00:00Z", summary: {} }));
    expect(html).toContain("Unknown age");
    expect(html).not.toContain("Live ·");
    expect(render(liveBundle())).toContain("Unknown age · run time not published yet");
  });
});

describe("pending states carried over from main (L14)", () => {
  const withPending = (b: CcBundle, tokens: string[]): CcBundle => ({ ...b, pending: tokens });

  test("pending tokens 'series' / 'priority_zones' force the neutral chip", () => {
    const b = bundle({ series: series([0.9]) });
    expect(render(b)).toContain("Tipping point reached");
    for (const token of ["series", "priority_zones"]) {
      const html = render(withPending(b, [token]));
      expect(html).toContain("No data for this event");
      expect(html).not.toContain("Tipping point reached");
    }
  });

  test("pending token 'metrics' hides every metric value", () => {
    const html = details(withPending(bundle({ metricsView: FULL_METRICS }), ["metrics"]));
    expect(html).not.toContain("8,400");
    expect(html).not.toContain("41.6 km²");
    expect(html).toContain("Exposure basis");
    const real = details(bundle({ metricsView: FULL_METRICS }));
    expect(real).toContain("8,400");
    expect(real).toContain("41.6 km²");
  });

  test("validation: missing fields read 'not published yet' next to real values", () => {
    const html = details(bundle({ metricsView: mv({ iou: 0.5 }) }));
    expect(html).toContain(">0.50<");
    expect(html).toContain("not published yet");
  });

  test("radar: a NISAR pair without a flooded area shows the label and 'not published yet'", () => {
    const html = render(bundle({ metricsView: mv({}), data_dates: { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" } }));
    expect(html).toMatch(/Flooded area \(NISAR\)<\/dt><dd[^>]*>not published yet/);
    expect(render(bundle({ metricsView: mv({}) }))).not.toContain("Flooded area");
  });

  test("radar: scars absent is 'not published yet', empty scars is a real zero, the token wins", () => {
    const label = /Landslide scar candidates \(OPERA DIST-ALERT-HLS, vegetation loss\)<\/dt><dd[^>]*>([^<]*)</;
    expect(render(bundle({ metricsView: mv({}) })).match(label)![1]).toBe("not published yet");
    expect(render(bundle({ metricsView: mv({}), scars: { type: "FeatureCollection", features: [] } })).match(label)![1]).toBe("0");
    const tok = render(withPending(bundle({
      metricsView: mv({}), scars: { type: "FeatureCollection", features: [point()] },
    }), ["landslide_candidates"]));
    expect(tok.match(label)![1]).toBe("not published yet");
  });

  test("now: an absent or pending summary shows no summary value; the source rows stay", () => {
    const html = render(liveBundle());
    for (const name of ["IMERG rain", "SMAP soil moisture", "NOAA GFS forecast"]) expect(html).toContain(name);
    expect(html).not.toContain("GEOS-FP forecast");
    const tok = render(withPending(liveBundle({ summary: { people_critical: 1200, critical_km2: { any: 4 } } }), ["summary"]));
    expect(tok).toContain("No live data yet");
    expect(tok).not.toContain("1,200");
  });

  test("the boundary credit follows the case", () => {
    expect(render(bundle())).toContain("US Census · Population");
    expect(render(bundle({ id: "rs_2024" }))).toContain("IBGE");
  });
});

describe("new assertions of the checklist", () => {
  test("a Now bundle with no series never renders 'Below the tipping point'", () => {
    const html = render(liveBundle());
    expect(html).toContain("No live data yet");
    expect(html).not.toContain("Below the tipping point");
    expect(html).not.toContain("Tipping point reached");
  });

  test("missing zones or people: null render 'not published yet', never 0", () => {
    const none = render(bundle({ pending: ["priority_zones"] }));
    expect(none).toContain("Priority areas: not published yet");
    expect(none).not.toContain("0.0 km²");
    const nullPeople = render(bundle({ zones: zones([zone(1), zone(2, { name: "Everett" })]) }));
    expect(nullPeople).toMatch(/People potentially exposed<\/div><div[^>]*><span[^>]*>not published yet/);
    expect(nullPeople).not.toMatch(/People potentially exposed<\/div><div[^>]*><span[^>]*>0/);
    expect(nullPeople.match(/not published yet/g)!.length).toBeGreaterThanOrEqual(3);
  });

  test("a value of exactly 0.60 gets one class on the chip, the list, the pin and the legend", () => {
    const b = bundle({ series: series([0.6]), zones: zones([zone(1, { tpi: 0.6, class: "Critical" })]) });
    const html = render(b);
    expect(html).toContain("Tipping point reached");
    expect(html).toContain("Critical (0.60 or more)");
    expect(html).toContain("High (0.40 to below 0.60)");
    expect(html).toMatch(/aria-label="Priority area 1: Darrington, Critical"/);
    const area = priorityAreas(b)[0];
    expect(area.cls).toBe("Critical"); // the pin takes its class from the same value
    const card = renderToStaticMarkup(<AreaCard area={area} expanded={false} onToggle={noop} onClose={noop} />);
    expect(card).toContain("Critical");
    expect(card).toContain("TPI 0.60");
  });

  test("Public Alerts shows 'data unavailable' on a load failure, never 'No active alerts'", () => {
    const html = render(liveBundle(), {}, "public", buildAlertList({ now: null, legacy: null }));
    expect(html).toContain("Alert data unavailable");
    expect(html).toContain("no run recorded");
    expect(html).not.toContain("No active alerts");
    const none = render(liveBundle(), {}, "public", buildAlertList({
      now: liveBundle({ updated_at: "2026-11-14T15:00:00Z", nowAlerts: { candidates: [] } }),
    }));
    expect(none).toContain("No active alerts");
    expect(none).toContain("Nov 14, 12:00 PM BRT");
  });

  test("the layer rule names the limit, and a named eviction is shown", () => {
    const html = render(bundle(), { layerNotice: "Rain turned off to show Flood" });
    expect(html).toContain("At most 2 data layers at once");
    expect(html).toContain("Rain turned off to show Flood");
  });
});

describe("public view (P1 to P5) and routes", () => {
  const alerts = buildAlertList({ now: liveBundle({ updated_at: "2026-11-14T15:00:00Z",
    data_dates: { imerg: "2026-11-14", smap: "2026-11-13" },
    nowAlerts: { candidates: [{ class: 3, label: "landslide", pixels: 80, hold: true }] } }) });

  test("an alert shows title, region, validity, certainty, held, guidance and the contact line", () => {
    const html = render(liveBundle(), {}, "public", alerts);
    for (const text of ["Tipping Point: CRITICAL landslide risk", "Region:", "monitored region",
      "Valid Nov 14, 2026", "certainty: high", "hazard: landslide", ">held<",
      "IMERG through Nov 14, 2026", "SMAP Nov 13, 2026", "SMS 40199", "Alerts by region", "View on the map"]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("Call 199");
  });

  test("paused alerts: a neutral notice, no card, no EMERGENCY", () => {
    const html = render(liveBundle(), {}, "public", { state: "paused", alerts: [], dataTime: "2026-11-15T04:15:23Z" });
    expect(html).toContain("Alerts paused while we verify today&#x27;s data");
    expect(html).toContain('data-alerts="paused"');
    expect(html).toContain("This does not mean there is no risk");
    expect(html).not.toContain("EMERGENCY");
    expect(html).not.toContain("No active alerts");
  });

  test("observed flood candidates: a neutral section, shown also while alerts are paused", () => {
    const live = liveBundle({ nowAlerts: { observed: [{ kind: "observed", hazard: "flood", source: "nisar-gcov",
      acquired: "2026-11-06T21:16:03Z", municipality: "Cananéia", uf: "SP", area_km2: 8.5, people: 343, polygons: 14 }] } as never });
    const html = render(live, {}, "public", { state: "paused", alerts: [] });
    expect(html).toContain("Observed by radar (candidates)");
    expect(html).toContain("Cananéia, SP");
    expect(html).toContain("NISAR radar");
    expect(html).toContain("343 people (estimate)");
    expect(html).toContain("Not an alert.");
    expect(html).not.toContain("EMERGENCY");
  });

  test("the public view changes the right panel only", () => {
    const html = render(liveBundle(), {}, "public", alerts);
    expect(html).toContain('aria-label="Map layers"');
    expect(html).toContain('aria-label="Previous step"');
    expect(html).not.toContain("Situation overview");
  });

  test("in Replay the panel lists what the live rule would have sent, up to the step, and offers Now", () => {
    const WA_SERIES = JSON.parse(readFileSync(join(process.cwd(), "test/fixtures/lead/wa_2025_series.json"), "utf8"));
    const b = bundle({ forecastLeadTime: WA_LEAD, series: WA_SERIES, zones: zones([zone(1), zone(2, { name: "Sultan" })]) });
    const dec5 = WA_SERIES.days.findIndex((d: { date: string }) => d.date === "2025-12-05");
    const html = render(b, { dayIndex: dec5 }, "public", alerts);
    expect(html).toContain("Replay: what would have been sent");
    expect(html).toContain("Replay: CRITICAL flood or landslide risk");
    expect(html).toContain("forecast · NOAA GFS (issued Dec 5, 2025)");
    expect(html).toContain("Darrington, Sultan (places as of Dec 10, 2025)");
    expect(html).toContain("2 more later in the replay");
    expect(html).toContain("Built from the replay TPI frames with the live alert rule. Not sent to anyone.");
    expect(html).toContain("Go to Now");
    expect(html).not.toContain("There is no public alert feed in replay.");
    expect(html).toContain("certainty: replay");
    expect(html).not.toContain("SMS 40199"); // Brazilian contact line: not on replay cards
    expect(html).not.toContain("Tipping Point: CRITICAL");
    expect(html).not.toContain("Replay: CRITICAL landslide risk");
    const later = render(b, { dayIndex: WA_SERIES.days.length - 1 }, "public", alerts);
    expect(later).toContain("Replay: CRITICAL landslide risk");
    expect(later).toContain("292 people in Critical areas (estimate)");
    expect(later).not.toContain("more later in the replay");
  });

  test("the Telegram card is hidden without a bot address and reads no location", () => {
    expect(render(liveBundle(), {}, "public")).not.toContain("Telegram");
    const html = render(liveBundle(), {}, "public", UNAVAILABLE, "https://t.me/example_bot");
    expect(html).toContain('href="https://t.me/example_bot"');
    expect(html).toContain("This page reads no location and stores nothing.");
  });

  test("no case loaded: the screen says data is unavailable", () => {
    const html = render([]);
    expect(html).toContain("Data unavailable");
    expect(html).not.toContain("Below the tipping point");
  });
});

describe("forecast issued this day: one source of truth (recording fixes)", () => {
  const gfs = (k: number, issued: string, date: string, extra: Record<string, unknown> = {}) => ({
    id: `tpi_slide_gfs_d${k}`, date, issued, png: `wa_2025/png/tpi_slide_gfs_d${k}_${date.replace(/-/g, "")}.png`,
    forecast: true, forecast_source: "noaa-gfs", kind: "forecast", ...extra });
  const wa = (extra: Record<string, unknown> = {}) => bundle({
    series: series([0, 0, 0, 1], ["observed", "observed", "observed", "forecast"], 0.6, 2),
    manifest: { ...manifest([]), layers: [
      { id: "tpi_slide", date: "2025-12-10", png: "wa_2025/png/tpi_slide_20251210.png" },
      gfs(3, "2025-12-10", "2025-12-13"), // post-event forecast-day frame (run issued on the event day)
      gfs(3, "2025-12-03", "2025-12-06", extra), // the overlay: run issued Dec 3, depicting Dec 6
    ] } as never,
  });
  test("tiles follow the overlay frame: figures when published, 'pending' otherwise — never the observed 0", () => {
    const b = wa();
    const steps = (b.series!.days as { date: string }[]);
    steps[0].date = "2025-12-03"; // the issue day as a timeline step
    const html = render(b, { dayIndex: 0, issueLead: 3, layers: ["tpi"], hazard: "slide" });
    expect(html).toContain("pending for this forecast frame");
    expect(html).toContain("forecast for Dec 6, 2025 (issued Dec 3, 2025)");
    const withFigures = wa({ critical_km2: 812.4, people_critical: 4321 });
    (withFigures.series!.days as { date: string }[])[0].date = "2025-12-03";
    const html2 = render(withFigures, { dayIndex: 0, issueLead: 3, layers: ["tpi"], hazard: "slide" });
    expect(html2).toContain("812.4 km²");
    expect(html2).toContain("4,321 (estimate)");
    expect(html2).toContain("forecast for Dec 6, 2025 (issued Dec 3, 2025)");
  });

  test("the timeline chip names the run of the frame on the map, never another run", () => {
    const b = wa();
    (b.series!.days as { date: string }[])[0].date = "2025-12-03";
    const html = render(b, { dayIndex: 0, issueLead: 3, layers: ["tpi"], hazard: "slide" });
    expect(html).toContain("forecast · NOAA GFS (issued Dec 3, 2025)");
    expect(html).not.toMatch(/>forecast · NOAA GFS \(issued Dec 10, 2025\)</);
  });
});

describe("no 'confirm' on screen except the tagline (candidates rule)", () => {
  test("the radar card and the layer rows never say a flood is confirmed", () => {
    const wa = bundle({ metricsView: { flooded_km2: 28 } as never,
      data_dates: { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" },
      products: { flood_confirmed: "wa_2025/geojson/flood_confirmed.geojson" } });
    // Allowed: the tagline (Lucas) and the rule itself ("never confirmed").
    const html = render(wa).replace("Rain warns. Radar confirms.", "").replaceAll("never confirmed", "");
    expect(html.match(/.{60}confirm.{40}/gi) ?? []).toEqual([]);
    expect(html).toContain("Check with NISAR radar");
    expect(html).toContain("NISAR radar maps flood candidates only in this case");
  });
});


describe("timeline chip never shows a bare 'perfect forecast'", () => {
  test("a case with GFS frames names NOAA GFS; a perfect-forecast-only case says upper bound", () => {
    const withGfs = bundle({ series: series([0.2, 0.9], ["observed", "forecast"]),
      manifest: { ...manifest([], { forecast_source: "perfect-forecast" }),
        layers: [{ id: "tpi_flood_gfs_d1", date: "2025-12-11", issued: "2025-12-10", png: "x.png", forecast_source: "noaa-gfs" }] } as never });
    expect(render(withGfs, { dayIndex: 0, layers: [] })).toContain(">Forecast (NOAA GFS)<");
    const pfOnly = bundle({ series: series([0.2, 0.9], ["observed", "forecast"]),
      manifest: manifest([], { forecast_source: "perfect-forecast" }) });
    const html = render(pfOnly, { dayIndex: 0, layers: [] });
    expect(html).toContain(">Forecast (perfect forecast · upper bound)<");
    expect(html).not.toContain(">Forecast (perfect forecast)<");
  });
});
