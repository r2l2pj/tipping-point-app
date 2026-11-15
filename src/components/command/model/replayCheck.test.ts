// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toMetricsView } from "../../../lib/contract";
import { bundle, liveBundle, manifest, point } from "./fixtures";
import { nightLightsCompare, radarCard, radarCompare } from "./radar";
import { sourceRows } from "./sources";
import { evidence, opticalSeenPct, replayCheckRows } from "./replayCheck";
import type { CcBundle } from "./types";

const mv = (m: Record<string, unknown>) => m as CcBundle["metricsView"];
const row = (b: CcBundle, id: string) => replayCheckRows(b).find((r) => r.id === id);

describe("replay check rows", () => {
  test("lead time shows median with IQR and n together, never alone", () => {
    const b = bundle({ metricsView: mv({ lead_time_median_h: 30, lead_time_iqr_h: [18, 42], lead_time_n: 12, never_critical_pct: 0.2 }) });
    expect(row(b, "lead-time")).toMatchObject({
      value: "Median 30 h · IQR 18–42 h · n = 12",
      detail: "20% never crossed Critical",
      missing: false,
    });
  });

  test("hours render whole: 47.5 shows as 48 h", () => {
    const value = row(bundle({ metricsView: mv({ lead_time_median_h: 47.5, lead_time_n: 5 }) }), "lead-time")!.value;
    expect(value).toContain("Median 48 h");
    expect(value).not.toContain("47.5");
  });

  test("an absent lead time, or one without n, reads 'pending: forecast rebuild'", () => {
    for (const m of [undefined, {}, { lead_time_median_h: null },
      { lead_time_median_h: -57, lead_time_iqr_h: [-57, -57], lead_time_n: null }]) {
      const r = row(bundle({ metricsView: mv(m as never) }), "lead-time")!;
      expect(r).toMatchObject({ value: "pending: forecast rebuild", missing: true });
    }
  });

  test("n comes from lead_time_n only; IQR is dropped when absent", () => {
    expect(row(bundle({ metricsView: mv({ lead_time_median_h: 12, lead_time_n: 7 }) }), "lead-time")!.value)
      .toBe("Median 12 h · n = 7");
    // the legacy n_points of the old run does not qualify a stat (real RS metrics)
    expect(row(bundle({ metricsView: mv({ lead_time_median_h: -57, lead_time_iqr_h: [-57, -57], lead_time_n: null, n_points: 5678 }) }), "lead-time")!.value)
      .toBe("pending: forecast rebuild");
  });

  test("'% warned first' is dropped: no row even when the metric is present", () => {
    expect(row(bundle({ metricsView: mv({ warned_before_pct: 0.0 }) }), "warned")).toBeUndefined();
    expect(row(bundle({ metricsView: mv({ warned_before_pct: 0.87 }) }), "warned")).toBeUndefined();
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
    // Internal pipeline reasons never reach the screen: a short phrase only.
    expect(row(b, "flood-agreement")!.value).toBe("pending");
  });

  test("flood agreement reads the like-for-like headline scores incl. P/R", () => {
    const wa = bundle({ metricsView: mv({
      iou: 0.08159565666049996, f1: 0.1508801485250636,
      precision: 0.18729061306361094, recall: 0.1263223039392064,
    }) });
    expect(row(wa, "flood-agreement")!.value).toBe("IoU 0.08 · F1 0.15 · P 0.19 · R 0.13");
    // P/R drop out of the row when absent.
    expect(row(bundle({ metricsView: mv({ iou: 0.5, f1: 0.6 }) }), "flood-agreement")!.value)
      .toBe("IoU 0.50 · F1 0.60");
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

  test("opticalSeenPct accepts 0-1 and 0-100 cloud_pct, never out of range", () => {
    expect(opticalSeenPct(0.95)).toBe(5);
    expect(opticalSeenPct(92.89292282546754)).toBe(7);
    expect(opticalSeenPct(100)).toBe(0);
    expect(opticalSeenPct(1)).toBe(0); // normalized 1.0 = 100% cloud
    expect(opticalSeenPct(0)).toBe(100);
    expect(opticalSeenPct(null)).toBeNull();
    expect(opticalSeenPct(undefined)).toBeNull();
    expect(opticalSeenPct(-3)).toBeNull();
    expect(opticalSeenPct(250)).toBeNull();
    expect(opticalSeenPct("92")).toBeNull();
  });

  test("published wa_2025 keys: like-for-like headline, *_raw secondary block", () => {
    const e = evidence(bundle({ metricsView: mv({
      iou: 0.08159565666049996, f1: 0.1508801485250636,
      precision: 0.18729061306361094, recall: 0.1263223039392064,
      validation_method: "like-for-like: NISAR new-flood mask vs OPERA DSWx-S1 new flood",
      iou_raw: 0.007528697499424659, f1_raw: 0.014944879521764607,
      precision_raw: 0.1981733990568252, recall_raw: 0.007765240364435442,
      opera_fn_diagnosis: "raw FN 1.19M px = permanent/pre-existing water",
      cloud_pct: 92.89292282546754,
    }) }));
    expect(e.floodStats.slice(0, 4).map((s) => `${s.label} ${s.value}`)).toEqual([
      "IoU 0.08", "F1 0.15", "Precision 0.19", "Recall 0.13",
    ]);
    // validation_method replaces the clear-sky note.
    expect(e.floodNote).toBe("like-for-like: NISAR new-flood mask vs OPERA DSWx-S1 new flood");
    expect(e.floodSecondary).toEqual({
      line: "IoU 0.01 · F1 0.01 · P 0.20 · R 0.01",
      diagnosis: "raw FN 1.19M px = permanent/pre-existing water",
    });
    // a raw 0-100 cloud_pct is rescaled once, never double-scaled
    expect(e.whyRadar).toContain("the optical saw only 7%");
  });

  test("no *_raw keys -> no secondary block; no validation_method -> clear-sky note", () => {
    const e = evidence(bundle({ metricsView: mv({ iou: 0.5 }) }));
    expect(e.floodSecondary).toBeUndefined();
    expect(e.floodNote).toContain("clear-sky reference cells only");
    // one *_raw key alone is enough to render the block
    expect(evidence(bundle({ metricsView: mv({ iou_raw: 0.01 }) })).floodSecondary).toBeDefined();
  });

  test("out-of-range cloud_pct yields no 'optical saw' sentence", () => {
    for (const cloud_pct of [-3, 250]) {
      const w = evidence(bundle({ metricsView: mv({ cloud_pct }) })).whyRadar;
      expect(w).not.toContain("the optical saw");
      expect(w).toContain("not reported");
    }
  });

  test("rs_2024: cloud_pct 100 -> 'the optical saw only 0%'", () => {
    expect(evidence(bundle({ metricsView: mv({ cloud_pct: 100 }) })).whyRadar)
      .toContain("the optical saw only 0%");
  });

  test("real public/data/metrics.json renders a sane optical % for every case", () => {
    const real = JSON.parse(
      readFileSync(join(import.meta.dir, "../../../../public/data/metrics.json"), "utf8")
    ) as { cases: Record<string, Record<string, unknown>> };
    for (const raw of Object.values(real.cases)) {
      if (raw.cloud_pct == null) continue;
      const cloud = Number(raw.cloud_pct);
      // metrics.json authors *_pct 0-100 (SCHEMA)
      const expected = Math.round(100 - cloud);
      // normalized path (what the loader builds via toMetricsView)
      expect(evidence(bundle({ metricsView: toMetricsView(raw) })).whyRadar)
        .toContain(`the optical saw only ${expected}%`);
      // raw path: an un-normalized value must not leak a negative percent
      const viaRaw = evidence(bundle({ metricsView: mv({ cloud_pct: cloud }) })).whyRadar;
      expect(viaRaw).toContain(`the optical saw only ${expected}%`);
      expect(viaRaw).not.toMatch(/saw only -/);
    }
  });

  test("the lead-time block: hidden without metrics, 'not published yet' without a median", () => {
    expect(evidence(bundle()).leadTime).toBeUndefined();
    const missing = evidence(bundle({ metricsView: mv({ lead_time_median_h: null }) })).leadTime!;
    expect(missing.missing).toBe("Lead time: pending: forecast rebuild.");
    expect(evidence(bundle({ metricsView: mv({ lead_time_median_h: 52 }) })).leadTime!.missing)
      .toBe("Lead time: pending: forecast rebuild."); // no n -> pending
    const lt = evidence(bundle({ metricsView: mv({ lead_time_median_h: 52, lead_time_n: 4 }) })).leadTime!;
    expect(lt.median).toBe("Tipping Point would have warned 52 hours earlier");
    expect(lt.iqr).toBe("n = 4");
    expect(lt.note).toContain("IMERG Early ~4 h");
  });

  test("people in critical areas follow the selected day", () => {
    const day = { date: "2025-12-12", offset: 2, kind: "observed" as const, imerg_mm: 1, smap: 0.5, tpi: 0.9, people_critical: 5300 };
    const b = bundle({ metricsView: mv({ people_critical: 8400 }) });
    expect(evidence(b, day).impactStats[0].value).toBe("5,300");
    expect(evidence(b).impactStats[0].value).toBe("8,400");
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

  test("passes of the live run are read: acquired, path, direction", () => {
    const live = [
      { granule: "NISAR_L0_A", acquired: "2026-11-13T21:25:37Z", path: 125, direction: "DESCENDING" },
      { granule: "NISAR_L0_B", acquired: "2026-11-14T09:37:37Z", path: 132, direction: "ASCENDING" },
      { granule: "NISAR_L0_C" },
    ];
    const b = bundle({ mode: "live", nisarPasses: live as never });
    // Newest first; a pass without a time is left out.
    expect(radarCard(b).passes).toEqual([
      { date: "2026-11-14T09:37:37Z", track: "132", note: "ascending" },
      { date: "2026-11-13T21:25:37Z", track: "125", note: "descending" },
    ]);
    expect(sourceRows(b).find((r) => r.id === "nisar")?.date).toBe("Nov 14, 06:37 AM BRT");
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
