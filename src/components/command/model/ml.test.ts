// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMlView, groupImportance } from "./ml";

// lead-ml sample files (main 1fe4aba): the SHAPE of the export; smoke numbers.
const read = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "test/fixtures/ml", f), "utf8"));

describe("buildMlView", () => {
  const card = read("ml_card.json");
  test("horizons in order, GFS first, low-skill horizons, all-events and per-event tables", () => {
    const v = buildMlView(card, "wa_2025")!;
    expect(v.horizons).toEqual(["24h", "48h", "72h", "7d", "14d"]);
    expect(v.sources).toEqual(["gfs", "perfect"]);
    expect(v.lowSkill).toEqual(["7d", "14d"]);
    const t = v.when["72h|gfs"];
    expect(t.rows.map((r) => r.model)).toEqual(["xgb_all", "rf_all", "rule_tpi"]);
    expect(t.rows.every((r) => r.n !== undefined && !r.missing)).toBe(true);
    expect(t.baseLine).toMatch(/^Base rate \d+\.\d% \(\d+ of [\d,]+ test samples\)$/);
    expect(v.event["72h|gfs"].fewPositives).toBe(true); // WA: 8 positives
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
  test("a smoke export with no gain charts nothing", () => {
    expect(groupImportance(read("feature_importance_3b.json"))).toBeUndefined();
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
