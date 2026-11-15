// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import {
  BASEMAP_STYLE_URL,
  basemapPlan,
  BM_PREFIX,
  BM_SAT_LYR,
  BM_SAT_SRC,
  parseBasemap,
} from "./basemap";

describe("basemap plan (L52)", () => {
  test("satellite: NASA GIBS VIIRS true colour dated by the case", () => {
    const p = basemapPlan("satellite", "2026-10-12");
    expect(p.satellite.on).toBe(true);
    expect(p.satellite.source).toBe(BM_SAT_SRC);
    expect(p.satellite.layer).toBe(BM_SAT_LYR);
    expect(p.satellite.tiles).toEqual([
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/2026-10-12/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg",
    ]);
    expect(p.satellite.tileSize).toBe(256);
    expect(p.satellite.maxzoom).toBe(9); // tile-set edge; the map overzooms
    expect(p.satellite.attribution).toContain("NASA GIBS");
    // Imagery is dark underneath -> the dark-matter (light-text) labels.
    expect(p.labels).toBe("dark");
    expect(p.streetsOn).toBe(false);
  });

  test("streets: voyager cartography under the app layers + voyager labels", () => {
    const p = basemapPlan("streets");
    expect(p.streetsOn).toBe(true);
    expect(p.labels).toBe("voyager");
    expect(p.satellite.on).toBe(false);
    expect(p.styleUrls.voyager).toBe(BASEMAP_STYLE_URL.voyager);
  });

  test("dark: no underlay at all; the dark-matter labels set", () => {
    const p = basemapPlan("dark");
    expect(p.satellite.on).toBe(false);
    expect(p.streetsOn).toBe(false);
    expect(p.labels).toBe("dark");
    expect(p.styleUrls.dark).toBe(BASEMAP_STYLE_URL.dark);
  });

  test("imagery date: live/invalid -> 'default' (latest published)", () => {
    for (const bad of [undefined, "", "2026-1-1", "today"]) {
      expect(basemapPlan("satellite", bad).satellite.tiles[0]).toContain("/default/default/");
    }
  });

  test("grafted-layer id prefixes are distinct and namespaced", () => {
    expect(new Set(Object.values(BM_PREFIX)).size).toBe(3);
    for (const p of Object.values(BM_PREFIX)) expect(p).toMatch(/^tp-bm-/);
  });
});

describe("parseBasemap", () => {
  test("accepts the three ids, rejects the rest", () => {
    expect(parseBasemap("dark")).toBe("dark");
    expect(parseBasemap("Satellite")).toBe("satellite");
    expect(parseBasemap(" streets ")).toBe("streets");
    for (const bad of [undefined, "", "osm", "SATELLITE2", "0"]) {
      expect(parseBasemap(bad)).toBeUndefined();
    }
  });
});
