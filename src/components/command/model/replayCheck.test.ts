// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { bundle, liveBundle, manifest, point } from "./fixtures";
import { nightLightsCompare, radarCard, radarCompare } from "./radar";
import { evidence, replayCheckRows } from "./replayCheck";
import type { CcBundle } from "./types";

const mv = (m: Record<string, unknown>) => m as CcBundle["metricsView"];
const row = (b: CcBundle, id: string) => replayCheckRows(b).find((r) => r.id === id);

describe("replay check rows", () => {
  test("lead time shows median with IQR and n together, never alone", () => {
    const b = bundle({ metricsView: mv({ lead_time_median_h: 30, lead_time_iqr_h: [18, 42], n_points: 12, never_critical_pct: 0.2 }) });
    expect(row(b, "lead-time")).toMatchObject({
      value: "Median 30 h · IQR 18–42 h · n = 12",
      detail: "20% never crossed Critical",
      missing: false,
    });
  });

  test("hours render whole: 47.5 shows as 48 h", () => {
    const value = row(bundle({ metricsView: mv({ lead_time_median_h: 47.5 }) }), "lead-time")!.value;
    expect(value).toContain("Median 48 h");
    expect(value).not.toContain("47.5");
  });

  test("an absent lead time reads 'not published yet', never an empty or zero row", () => {
    for (const m of [undefined, {}, { lead_time_median_h: null }]) {
      const r = row(bundle({ metricsView: mv(m as never) }), "lead-time")!;
      expect(r).toMatchObject({ value: "not published yet", missing: true });
    }
  });

  test("rows follow the metrics each case has", () => {
    const wa = bundle({ metricsView: mv({ flooded_km2: 27.99, flooded_km2_scope: "within NISAR swath", swath_coverage_pct: 0.741 }),
      data_dates: { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" } });
    expect(replayCheckRows(wa).map((r) => r.id)).toEqual(["lead-time", "flooded"]);
    expect(row(wa, "flooded")).toMatchObject({
      name: "Flooded area (NISAR)", value: "28.0 km²",
      detail: "within the NISAR swath — 74% of the area covered",
    });
    const rs = bundle({ metricsView: mv({ landslide_hit_pct: 0.85855 }) });
    expect(replayCheckRows(rs).map((r) => r.id)).toEqual(["lead-time", "catalog-hits"]);
    expect(row(rs, "catalog-hits")!.value).toBe("86%");
  });

  test("the two AUC values are labelled", () => {
    const b = bundle({ metricsView: mv({ rf_auc: 0.91, rule_auc: 0.74 }) });
    expect(row(b, "model")!.value).toBe("ML model AUC (XGBoost) 0.91 · Manual slope-rule AUC 0.74");
  });

  test("a null metric shows its reason", () => {
    const b = bundle({ metricsView: mv({}), nullReasons: { iou: "no reference mask" } });
    expect(row(b, "flood-agreement")!.value).toBe("not published yet (no reference mask)");
  });

  test("no rows in Now", () => {
    expect(replayCheckRows(liveBundle())).toEqual([]);
  });
});

describe("evidence", () => {
  test("cloud_pct 0.95 gives 'the optical saw only 5%'", () => {
    expect(evidence(bundle({ metricsView: mv({ cloud_pct: 0.95 }) })).whyRadar)
      .toContain("the optical saw only 5%");
  });

  test("the lead-time block: hidden without metrics, 'not published yet' without a median", () => {
    expect(evidence(bundle()).leadTime).toBeUndefined();
    const missing = evidence(bundle({ metricsView: mv({ lead_time_median_h: null }) })).leadTime!;
    expect(missing.missing).toBe("Lead-time hindcast: not published yet — IMERG latency-aware rerun not published for this case.");
    expect(evidence(bundle({ metricsView: mv({ lead_time_median_h: 52 }) })).leadTime!.median)
      .toBe("Tipping Point would have warned 52 hours earlier");
    const lt = evidence(bundle({ metricsView: mv({ lead_time_median_h: 0 }) })).leadTime!;
    expect(lt.iqr).toBe("IQR not reported–not reported h · n = not reported");
    expect(lt.note).toContain("IMERG Early ~4 h");
  });

  test("missing impact values read 'not published yet'", () => {
    const e = evidence(bundle({ metricsView: mv({ flooded_km2: 41.6 }) }));
    expect(e.impactStats.map((s) => s.value)).toEqual([
      "not published yet", "not published yet", "41.6 km²", "not published yet",
    ]);
    expect(e.exposureBasis).toContain("TPI ≥ 0.60 cells");
  });
});

describe("radar card", () => {
  test("scar count is labelled as candidates, never confirmed", () => {
    const card = radarCard(bundle({ scars: { type: "FeatureCollection", features: [point(), point(), point()] } }));
    expect(card.candidates).toMatchObject({ label: "Landslide scar candidates (HLS optical)", value: "3" });
    expect(JSON.stringify(card)).not.toMatch(/confirmed (scar|landslide)/i);
  });

  test("swath scope renders whole coverage on either percent scale", () => {
    for (const swath_coverage_pct of [0.426, 42.6]) {
      const card = radarCard(bundle({ metricsView: mv({ flooded_km2: 41.6, flooded_km2_scope: "within NISAR swath", swath_coverage_pct }) }));
      expect(card.flooded!.swath).toBe("within the NISAR swath — 43% of the area covered");
    }
  });

  test("swath coverage stays hidden without scope, finite coverage or a flooded value", () => {
    for (const extra of [{}, { swath_coverage_pct: 0.4 }, { flooded_km2_scope: "within NISAR swath" },
      { flooded_km2_scope: "within NISAR swath", swath_coverage_pct: NaN },
      { flooded_km2_scope: "within NISAR swath", swath_coverage_pct: "40" },
      { flooded_km2_scope: "within NISAR swath", swath_coverage_pct: 0.4, flooded_km2: undefined }]) {
      const card = radarCard(bundle({ metricsView: mv({ flooded_km2: 41.6, ...extra }) }));
      expect(card.flooded?.swath).toBeUndefined();
    }
  });

  test("replay without a pair: observed reference, no NISAR label", () => {
    const card = radarCard(bundle({ metricsView: mv({ flooded_km2: 118.3 }), data_dates: { nisar_pre: null, nisar_post: null } }));
    expect(card.flooded).toMatchObject({ label: "Flooded area (observed reference)", value: "118.3 km²" });
    expect(card.headline).toBe("No radar for this event (before NISAR launch).");
    expect(card.limitation).toBeUndefined();
    expect(card.compare.reason).toBe("No radar for this event (before NISAR launch)");
  });

  test("flood_source 'opera' labels the value optical/OPERA", () => {
    const card = radarCard(bundle({ metricsView: mv({ flooded_km2: 118.3, flood_source: "opera" }) }));
    expect(card.flooded!.label).toBe("Flooded area (optical/OPERA reference)");
  });

  test("a data_dates pair shows the NISAR label, the dates and the declared limit", () => {
    const card = radarCard(bundle({ metricsView: mv({ flooded_km2: 41.6 }),
      data_dates: { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" } }));
    expect(card.flooded!.label).toBe("Flooded area (NISAR)");
    expect(card.dates).toBe("Dec 4, 2025 → Dec 16, 2025");
    expect(card.limitation).toContain("declared limitation");
    expect(card.compare).toEqual({ kind: "radar", reason: "images not published yet" });
  });

  test("live case without a pair keeps the awaiting copy", () => {
    expect(radarCard(liveBundle()).headline).toBe("Awaiting a NISAR pair over the AOI.");
  });

  test("the pass list comes from data_dates", () => {
    const passes = [{ date: "2025-11-10", track: "T048", note: "no-event reference" }];
    expect(radarCard(bundle({ data_dates: { nisar_passes: passes } })).passes).toEqual(passes);
  });

  test("a published image pair enables the comparison", () => {
    const b = bundle({ manifest: manifest([
      { id: "nisar_pre", date: "2025-12-04", png: "wa_2025/png/nisar_pre.png", bounds: [-122, 47, -121, 48] },
      { id: "nisar_post", date: "2025-12-16", png: "wa_2025/png/nisar_post.png", bounds: [-122.5, 47, -121, 48.5] },
    ]) });
    const option = radarCompare(b);
    expect(option.pair).toMatchObject({
      bounds: [-122.5, 47, -121, 48.5],
      before: { url: "/data/wa_2025/png/nisar_pre.png", label: "pre-event GCOV — Dec 4, 2025" },
      after: { label: "post-event GCOV — Dec 16, 2025" },
    });
    expect(nightLightsCompare(b).reason).toBe("images not published yet");
  });
});
