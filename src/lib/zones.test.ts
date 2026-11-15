// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { standardFlood } from "./layers";
import { observedOnlyZone, tpiOnlyZone, zoneSources } from "./zones";

describe("R3 zone sources", () => {
  test("arrays and MapLibre-stringified arrays both read", () => {
    expect(zoneSources({ sources: ["nisar-gcov"] })).toEqual(["nisar-gcov"]);
    expect(zoneSources({ sources: '["tpi-critical","opera-dswx-s1"]' })).toEqual(["tpi-critical", "opera-dswx-s1"]);
    expect(zoneSources({})).toBeUndefined();
  });
  test("observed-only vs TPI-only; replay zones are neither", () => {
    expect(observedOnlyZone({ sources: ["nisar-gcov"] })).toBe(true);
    expect(observedOnlyZone({ sources: ["tpi-critical", "nisar-gcov"] })).toBe(false);
    expect(tpiOnlyZone({ sources: ["tpi-critical"] })).toBe(true);
    expect(tpiOnlyZone({ sources: ["tpi-critical", "opera-dswx-s1"] })).toBe(false);
    expect(observedOnlyZone({ class: "Critical" })).toBe(false);
    expect(tpiOnlyZone({ class: "Critical" })).toBe(false);
  });
});

describe("standardFlood", () => {
  test("merges files, drops lower confidence and missing files", () => {
    const f = (confidence?: string) => ({ type: "Feature" as const, properties: { confidence }, geometry: null as never });
    const out = standardFlood([
      { type: "FeatureCollection", features: [f()] },
      null,
      { type: "FeatureCollection", features: [f("standard"), f("lower")] },
    ]);
    expect(out.features.map((x) => x.properties?.confidence)).toEqual([undefined, "standard"]);
  });
});
