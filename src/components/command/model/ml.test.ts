// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMlView, groupImportance, ML_PROVISIONAL, mlCaveats } from "./ml";

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
