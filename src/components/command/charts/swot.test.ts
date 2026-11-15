// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSwot } from "./swot";

const WA = JSON.parse(readFileSync(join(process.cwd(), "test/fixtures/lead/wa_2025_swot.json"), "utf8"));

describe("parseSwot", () => {
  test("WA per-reach file: 4 reaches with data, change from first pass, quality stated, missing reaches named", () => {
    const v = parseSwot(WA)!;
    expect(v.kind).toBe("reaches");
    expect(v.reaches).toHaveLength(4);
    expect(v.reaches.every((r) => r.points[0].m === 0)).toBe(true);
    expect(v.reaches.reduce((n, r) => n + r.points.length, 0)).toBe(46);
    expect(v.qualityNote).toContain("no 'good' quality");
    expect(v.missing).toEqual([
      "reach 78310800011: not in the SWOT river database",
      "reach 78310800055: not in the SWOT river database",
    ]);
    expect(v.eventPeak).toBe(Date.parse("2025-12-10T12:00:00Z"));
  });

  test("legacy flat shape still reads; junk is no data", () => {
    expect(parseSwot([{ date: "2025-12-01", river_m: 3.2 }])!.reaches[0].points[0].m).toBe(3.2);
    expect(parseSwot({})).toBeUndefined();
    expect(parseSwot(null)).toBeUndefined();
  });
});
