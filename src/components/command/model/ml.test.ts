// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMlView, groupImportance, ML_PROVISIONAL, mlCaveats, spreadFor, spreadLine } from "./ml";

// lead-ml sample files (main 1fe4aba): the SHAPE of the export; smoke numbers.
const read = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "test/fixtures/ml", f), "utf8"));

describe("buildMlView", () => {
  const card = read("ml_card.json");
  test("horizons in order, GFS first, low-skill horizons, all-events and per-event tables", () => {
    const v = buildMlView(card, "wa_2025")!;
    expect(v.horizons).toEqual(["24h", "48h", "72h", "7d", "14d"]);
    // L33: GFS tables are superseded while the card is provisional.
    expect(v.sources).toEqual(ML_PROVISIONAL ? ["perfect"] : ["gfs", "perfect"]);
    expect(v.lowSkill).toEqual(["7d", "14d"]);
    const t = v.when["72h|perfect"];
    expect(t.rows.map((r) => r.model)).toEqual(["xgb_all", "rf_all", "rule_tpi"]);
    expect(t.rows.every((r) => r.n !== undefined && !r.missing)).toBe(true);
    expect(t.baseLine).toMatch(/^Base rate \d+\.\d% \([\d,]+ of [\d,]+ test samples\)$/);
    expect(v.event["72h|perfect"].fewPositives).toBe(true); // WA: 8 positives
    expect(v.when["72h|gfs"]).toBeUndefined();
    expect(v.eventId).toBe("wa_2025");
  });
  test("a row without n shows no numbers", () => {
    const c = { trigger: { "24h": { gfs: { xgb_all: { test: { precision: 0.9, recall: 0.9 } } } } } };
    const r = buildMlView(c)!.when["24h|gfs"].rows[0];
    expect(r.missing).toBe(true);
    expect(r.cells.precision).toBe("—");
  });
  test("3a table from t_ml; junk is no card", () => {
    expect(buildMlView(card)!.where!.rows.map((r) => r.model)).toEqual(["xgb_all", "rf_all", "rule_slope"]);
    expect(buildMlView(null)).toBeUndefined();
    expect(buildMlView({})).toBeUndefined();
  });
});

describe("groupImportance", () => {
  test("an export with no gain charts nothing", () => {
    const raw = read("feature_importance_3b.json");
    raw.rows = raw.rows.map((r: Record<string, unknown>) => ({ ...r, gain_share: 0 }));
    expect(groupImportance(raw)).toBeUndefined();
  });
  test("groups with labels from the export, ordered by gain", () => {
    const raw = read("feature_importance_3b.json");
    raw.rows = raw.rows.map((r: Record<string, unknown>, i: number) => ({ ...r, gain_share: (i % 4) / 10 }));
    const v = groupImportance(raw)!;
    expect(v.groups.length).toBeGreaterThan(0);
    expect(v.groups.map((g) => g.label)).toContain("Surface (MCD12Q1 + VIIRS NDVI)");
    for (let i = 1; i < v.groups.length; i++) expect(v.groups[i - 1].gain >= v.groups[i].gain).toBe(true);
  });
});

describe("real export (lead-ml, data main 1b943b6)", () => {
  const v = buildMlView(read("ml_card.json"), "rs_2024")!;
  test("72h (perfect forecast, L33): XGBoost vs random forest vs TPI rule, each with n and a base rate", () => {
    const t = v.when["72h|perfect"];
    expect(t.rows.map((r) => r.model)).toEqual(["xgb_all", "rf_all", "rule_tpi"]);
    expect(t.rows.every((r) => !r.missing && r.n !== undefined && r.nPos !== undefined)).toBe(true);
    expect(t.baseLine).toMatch(/^Base rate \d+\.\d% \([\d,]+ of [\d,]+ test samples\)$/);
  });
  test("caveats in plain words: one RS event + 8 WA points, 2015-18 vs 2024-25, rain WHEN / terrain WHERE, 7d/14d low skill", () => {
    const c = mlCaveats(v).join(" ");
    expect(c).toContain("ONE event — Rio Grande do Sul, May 2024 — plus 8 dated landslide reports from Washington 2025");
    expect(c).toContain("Trained on the 2015–2018 landslide catalog; tested on 2024–2025 events");
    expect(c).toContain("Rain decides WHEN");
    expect(c).toContain("terrain model decides WHERE");
    expect(c).toContain("7d and 14d horizons rely on long-range forecast: low skill.");
  });
  test("importance groups from the real export", () => {
    const g = groupImportance(read("feature_importance_3b.json"))!;
    expect(g.groups.length).toBeGreaterThan(1);
    expect(Math.round(g.groups.reduce((a, x) => a + x.gain, 0) * 100)).toBe(100);
  });
});

describe("served T_ML model first (lead-analysis review)", () => {
  test("the map's model (t_ml.json model) leads the 'where' table, labelled", () => {
    const tml = read("t_ml.json");
    const v = buildMlView(read("ml_card.json"), "rs_2024", tml.model)!;
    const first = v.where!.rows[0];
    expect(first.model).toBe("xgb_terrain_landcover");
    expect(first.label).toMatch(/— the model on the map$/);
    expect(first.cells.rocAuc).toBe("0.97");
    expect(first.cells.prAuc).toBe("0.49");
    expect(v.where!.rows.map((r) => [r.model, r.n, r.nPos, r.cells.rocAuc])).toEqual([
      ["xgb_terrain_landcover", 2039, 45, "0.97"], ["rf_all", 2039, 45, "0.92"], ["rule_slope", 2039, 45, "0.86"],
    ]);
    expect(v.where!.baseLine).toBe("Base rate 2.2% (45 of 2,039 test samples)");
  });
});

describe("lead-ml ea5b2cd: served label and calibration note", () => {
  test("label reads the served model once; the calibration note is plain", () => {
    const v = buildMlView(read("ml_card.json"), "rs_2024", "xgb_terrain_landcover")!;
    expect(v.where!.rows[0].label).toBe("XGBoost terrain + land cover — the model on the map");
    expect(v.calibrationNote).toContain("Before calibration the models rank in a different order");
  });
});

describe("ML v2: horizons from the export", () => {
  test("three horizons (24h, 72h, 7d) are listed as published", () => {
    const card = read("ml_card.json");
    const t = card.trigger;
    const v2 = { ...card, trigger: { "24h": t["24h"], "72h": t["72h"], "7d": t["7d"] }, low_skill_horizons: ["7d"] };
    const v = buildMlView(v2, "rs_2024")!;
    expect(v.horizons).toEqual(["24h", "72h", "7d"]);
    expect(v.lowSkill).toEqual(["7d"]);
  });
});

describe("ML v2 caveat wording", () => {
  test("more TEST events than RS + WA: no 'ONE event' claim, the count instead", () => {
    const c = mlCaveats({ testEvents: ["ev_a", "rs_2024", "wa_2025"], lowSkill: [] } as never);
    expect(c[0]).toBe("The TEST covers 3 events the models never saw; with this few events the scores can still move.");
    expect(c.join(" ")).not.toContain("ONE event");
  });
});

describe("ML v2 card (data/ml/ml_card_v2.json)", () => {
  const v1 = read("ml_card.json");
  const g = (median: number, min: number, max: number, worst: string, n = 7) =>
    ({ pooled: 0.5, events_n: n, event_median: median, event_min: min, event_max: max, worst_event: worst, loeo_min: 0.3, loeo_max: 0.6 });
  const v2 = {
    ...v1,
    version: "v2",
    t_ml_excludes_rs: true,
    test_events: [
      { id: "rs_2024", name: "Rio Grande do Sul 2024", n_pos: 900, source: "UFRGS inventory" },
      { id: "helene_2024", name: "Helene 2024", n_pos: 120, source: "USGS" },
      { id: "maria_2017", name: "Maria 2017", n_pos: 300, source: "USGS" },
    ],
    generalise: {
      gfs: { "24h": { xgb_all: g(0.41, 0.12, 0.8, "helene_2024", 2) }, "7d": { xgb_all: g(0.2, 0.1, 0.3, "x", 0) } },
      perfect: { "24h": { xgb_all: g(0.55, 0.2, 0.9, "maria_2017", 3) }, "7d": { xgb_all: g(0.3, 0.1, 0.5, "maria_2017", 3) } },
    },
  };

  test("v1 stays provisional with GFS hidden; v2 lifts both", () => {
    const a = buildMlView(v1, "rs_2024")!;
    expect(a.provisional).toBe(true);
    expect(a.sources).toEqual(["perfect"]);
    const b = buildMlView(v2, "rs_2024")!;
    expect(b.provisional).toBe(false);
    expect(b.version).toBe("v2");
    expect(b.sources).toEqual(["gfs", "perfect"]);
    expect(b.tmlExcludesRs).toBe(true);
    expect(b.testEventList.map((e) => e.name)).toEqual(["Rio Grande do Sul 2024", "Helene 2024", "Maria 2017"]);
  });

  test("caveat counts the v2 event list, never 'ONE event'", () => {
    const c = mlCaveats(buildMlView(v2, "rs_2024")!).join(" ");
    expect(c).toContain("The TEST covers 3 events");
    expect(c).not.toContain("ONE event");
  });

  test("spread: GFS when events_n > 0, else observed rain; worst event by name", () => {
    const b = buildMlView(v2, "rs_2024")!;
    const s24 = spreadFor(b, "24h", "gfs")!;
    expect(s24.source).toBe("gfs");
    expect(spreadLine(s24.rows[0], s24.source))
      .toBe("PR-AUC across 2 events (NOAA GFS forecast): median 0.41 (range 0.12–0.80; weakest: Helene 2024)");
    const s7 = spreadFor(b, "7d", "gfs")!;
    expect(s7.source).toBe("perfect");
    expect(spreadLine(s7.rows[0], s7.source)).toContain("(observed rain)");
    expect(spreadFor(b, "72h", "gfs")).toBeUndefined();
    expect(spreadFor(buildMlView(v1, "rs_2024")!, "24h", "gfs")).toBeUndefined();
  });
});

describe("ML v2 real export (lead-ml fallback f5fbab1, trimmed fixture)", () => {
  const card = read("ml_card_v2.json");
  const v = buildMlView(card, "rs_2024", "xgb_all")!;
  test("v2: no provisional banner, GFS back, headline held, VAL next to TEST", () => {
    expect(v.provisional).toBe(false);
    expect(v.sources).toEqual(["gfs", "perfect"]);
    expect(v.horizons).toEqual(["24h", "48h", "72h", "7d"]);
    expect(v.headlineHeld).toBe("Not a headline yet — independent overfit audit pending.");
    expect(v.valNote).toContain("VAL PR-AUC (24h ~0.13)");
    const rows = v.when["24h|gfs"].rows;
    expect(rows.map((r) => r.model)).toEqual(["xgb_rain_soil", "xgb_all", "rf_all", "rule_tpi", "climatology"]);
    expect(rows[0].label).toBe("XGBoost rain + soil — the model live");
    expect(rows[0].cells.prAuc).toBe("0.62");
    expect(rows[0].valPrAuc).toBe("0.13");
    expect(rows[4].label).toBe("XGBoost no rain/soil (baseline)");
    expect(v.servedLine).toBe("The live layer runs XGBoost rain + soil.");
  });
  test("events: 11 with years 2017–2025, sources say when there was no GFS archive", () => {
    expect(v.testEventList).toHaveLength(11);
    const maria = v.testEventList.find((e) => e.id === "maria_2017")!;
    expect(maria.source).toBe("observed rain only (no GFS archive)");
    expect(maria.nPos).toBe(6000);
    const c = mlCaveats(v);
    expect(c[0]).toContain("The TEST covers 11 events");
    expect(c[1]).toBe("Trained on dated landslide catalogs (GLC/COOLR, worldwide); tested on 11 disaster events from 2017–2025 it never saw.");
    expect(c.join(" ")).not.toContain("2015–2018 landslide catalog");
  });
  test("spread per source; T_ML v2 note; calibration note makes no ranking claim", () => {
    const sp = spreadFor(v, "24h", "gfs")!;
    expect(sp.source).toBe("gfs");
    expect(spreadLine(sp.rows[0], sp.source)).toMatch(/^PR-AUC across 8 events \(NOAA GFS forecast\): median 0\.68 \(range [0-9.]+–[0-9.]+; weakest: Petrópolis|^PR-AUC across 8 events \(NOAA GFS forecast\): median 0\.68 \(range [0-9.]+–[0-9.]+; weakest: /);
    expect(v.tmlExcludesRs).toBe(true);
    expect(v.where!.rows[0].label).toContain("the model on the map");
    expect(v.calibrationNote).toBe("Scores of the calibrated models, as served on the map.");
    // lead-ml: RS baseline inflated by day-of-year (test design), captioned
    expect(v.eventNote).toBe("RS climatology score is inflated: all RS landslides fall in one season while comparison dates span the year.");
    expect(buildMlView(card, "wa_2025", "xgb_all")!.eventNote).toBeUndefined();
  });
});
