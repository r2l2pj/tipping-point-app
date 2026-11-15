// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toMetricsView } from "../../../lib/contract";
import { bundle, liveBundle, manifest, point } from "./fixtures";
import { toNowDist } from "../../../lib/response";
import { nightLightsCompare, radarCard, radarCompare } from "./radar";
import { sourceRows } from "./sources";
import { evidence, opticalSeenPct, replayCheckRows } from "./replayCheck";
import type { CcBundle } from "./types";

const mv = (m: Record<string, unknown>) => m as CcBundle["metricsView"];
const WA_LEAD = JSON.parse(readFileSync(join(process.cwd(), "test/fixtures/lead/forecast_lead_time_wa_2025.json"), "utf8"));
const RS_LEAD = JSON.parse(readFileSync(join(process.cwd(), "test/fixtures/lead/forecast_lead_time_rs_2024.json"), "utf8"));
const row = (b: CcBundle, id: string) => replayCheckRows(b).find((r) => r.id === id);

describe("replay check rows", () => {
  // Real files of lead-analysis (data/<case>/forecast_lead_time.json).
  test("WA: median with IQR and 'k of n forecast days' — the submission headline words", () => {
    const b = bundle({ forecastLeadTime: WA_LEAD });
    expect(row(b, "lead-time")).toMatchObject({
      name: "Lead time before the damage (NOAA GFS forecast replay)",
      value: "median 85 h (IQR 55–115 h, 6 of 8 forecast days)",
      missing: false,
    });
  });

  test("RS: one flagging day is never a median", () => {
    const value = row(bundle({ id: "rs_2024", forecastLeadTime: RS_LEAD }), "lead-time")!.value;
    expect(value).toBe("1 of 4 forecast days flagged it, 111 h ahead");
    expect(value).not.toContain("median");
  });

  test("two flagging days show both values", () => {
    const two = { ...WA_LEAD, n_warned: 2, issue_days: (WA_LEAD.issue_days as Record<string, unknown>[])
      .map((d, i) => (i === 2 || i === 3 ? d : { ...d, warned: false, lead_h: null })) };
    expect(row(bundle({ forecastLeadTime: two }), "lead-time")!.value)
      .toBe("2 of 8 forecast days flagged it, 145 h and 121 h ahead");
  });

  test("the file wins; metrics.forecast_lead_time is the fallback", () => {
    expect(row(bundle({ metricsView: mv({ forecast_lead_time: WA_LEAD }) }), "lead-time")!.value)
      .toBe("median 85 h (IQR 55–115 h, 6 of 8 forecast days)");
  });

  test("the older event-anchor stat never shows: absent forecast lead reads 'pending: forecast rebuild'", () => {
    for (const m of [undefined, {}, { lead_time_median_h: null },
      { lead_time_median_h: -57, lead_time_iqr_h: [-57, -57], lead_time_n: 5678 },
      { lead_time_median_h: 30, lead_time_iqr_h: [18, 42], lead_time_n: 12 }]) {
      const r = row(bundle({ metricsView: mv(m as never) }), "lead-time")!;
      expect(r).toMatchObject({ value: "pending: forecast rebuild", missing: true });
    }
    expect(row(bundle({ forecastLeadTime: { ...WA_LEAD, n_warned: 0 } }), "lead-time")!.value)
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

  test("no bare AUC row: model scores only appear with their n (ML card)", () => {
    const b = bundle({ metricsView: mv({ rf_auc: 0.91, rule_auc: 0.74 }) });
    expect(row(b, "model")).toBeUndefined();
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

  test("the lead-time block: hidden without metrics, pending without a forecast lead", () => {
    expect(evidence(bundle()).leadTime).toBeUndefined();
    const missing = evidence(bundle({ metricsView: mv({ lead_time_median_h: -57, lead_time_n: 5678 }) })).leadTime!;
    expect(missing.missing).toBe("Lead time: pending: forecast rebuild.");
    const wa = evidence(bundle({ metricsView: mv({}), forecastLeadTime: WA_LEAD })).leadTime!;
    expect(wa.median).toBe("Using the forecast available at the time: median 85 h (IQR 55–115 h, 6 of 8 forecast days)");
    expect(wa.lines).toEqual(["Earliest forecast run that flagged it: Dec 3, 2025 (00Z)", "Damage anchor: Dec 9, 2025 00:35 UTC"]);
    const rs = evidence(bundle({ metricsView: mv({}), forecastLeadTime: RS_LEAD })).leadTime!;
    expect(rs.median).toBe("Using the forecast available at the time: 1 of 4 forecast days flagged it, 111 h ahead");
    expect(rs.histogram).toBeUndefined();
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
    expect(card.candidates).toMatchObject({ label: "Landslide scar candidates (OPERA DIST-ALERT-HLS, vegetation loss)", value: "3" });
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

  test("RS scar candidates: count, area, people and the inventory check from metrics scar_*", () => {
    const card = radarCard(bundle({ id: "rs_2024", metricsView: mv({ scar_candidates_n: 2849, scar_candidates_km2: 20.02,
      scar_people: 522.3, scar_hit_500m_pct: 46.13, scar_precision_500m_pct: 55.07, scar_inventory_n: 16027 }) }));
    expect(card.candidates.value).toBe("2,849");
    expect(card.candidates.lines).toEqual([
      "20.0 km² · 522 people (estimate)",
      "46% of the 16,027 inventoried landslides lie within 500 m of a candidate; 55% of candidates within 500 m of one.",
    ]);
    expect(JSON.stringify(card.candidates)).not.toMatch(/(?<!never )confirmed/);
  });

  test("Now scar candidates: meta figures, publication lag and the harvest/fire caveat", () => {
    const dist = toNowDist({ features: 685, candidates_km2: 3.295, people: 89.2, latest_acquired: "2026-11-05T13:52:01.437Z",
      caveat: "vegetation loss on steep slopes outside a rain event is mostly forestry harvest / fire" })!;
    const card = radarCard(liveBundle({ dist }));
    expect(card.candidates.value).toBe("685");
    expect(card.candidates.lines).toEqual([
      "3.3 km² · 89 people (estimate)",
      "Newest image Nov 5, 2026 — the product is published 1–2 weeks after the pass.",
      "Caveat: Vegetation loss on steep slopes outside a rain event is mostly forestry harvest / fire.",
    ]);
    expect(toNowDist({})).toBeUndefined();
  });

  test("live case without a pair keeps the awaiting copy", () => {
    expect(radarCard(liveBundle()).headline).toBe("Awaiting a NISAR pair over the AOI.");
  });

  test("live radar response: candidates wording, area, people, pass age, no replay limitation", () => {
    const live = liveBundle({
      response: { source: "nisar-gcov", flooded_km2: 12.06, people_flooded: 384, latency_h: 99.7,
        pre_acquired: "2026-10-25T21:16:03Z", post_acquired: "2026-11-06T21:16:03Z" },
      data_dates: { nisar_pre: "2026-10-25T21:16:03Z", nisar_post: "2026-11-06T21:16:03Z" },
      products: { flood_confirmed: "response/flood_nisar.geojson" },
    });
    const card = radarCard(live);
    expect(card.pair).toBe(true);
    expect(card.headline).toBe("NISAR pair available");
    expect(card.dates).toBe("Oct 25, 2026 → Nov 6, 2026");
    expect(card.flooded).toEqual({ label: "Flooded area (NISAR radar, candidates)", value: "12.1 km²" });
    expect(card.people).toEqual({ label: "People in the flooded area (estimate)", value: "384" });
    expect(card.note).toContain("not yet checked on the ground");
    expect(card.note).toContain("100 h after the radar pass");
    expect(card.limitation).toBeUndefined();
    expect(card.canShowOnMap).toBe(true);
    expect(JSON.stringify([card.flooded, card.note, card.headline])).not.toMatch(/confirmed/i);
  });

  test("the R3 NISAR figures win over the meta (same numbers as the public view)", () => {
    const card = radarCard(liveBundle({
      response: { source: "nisar-gcov", flooded_km2: 2.3, people_flooded: 82 },
      responseSources: [{ source: "nisar-gcov", flooded_km2: 2.31, people_flooded: 43 }],
      data_dates: { nisar_pre: "2026-10-25", nisar_post: "2026-11-06" },
    }));
    expect(card.people?.value).toBe("43");
  });

  test("live response with a null area shows the short reason, never the raw note", () => {
    const card = radarCard(liveBundle({
      response: { source: "nisar-gcov", null_reasons: { flooded_km2: "No local labeled feature for x" } },
    }));
    expect(card.flooded!.value).not.toContain("labeled feature");
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

  test("the pass count survives the list cut to the cards shown", () => {
    const passes = [{ date: "2026-11-14T09:37:37Z", track: "132" }];
    const card = radarCard(bundle({ mode: "live", nisarPasses: passes, nisarPassCount: 118 }));
    expect(card.passes).toHaveLength(1);
    expect(card.passCount).toBe(118);
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
