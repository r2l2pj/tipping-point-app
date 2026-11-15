// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { basemapSources, BASEMAP_ORDER, parseBasemap } from "./basemap";

const byId = (basemap: Parameters<typeof basemapSources>[0], date?: string) =>
  Object.fromEntries(basemapSources(basemap, date).map((s) => [s.id, s]));

describe("basemap sources (L52)", () => {
  test("satellite: NASA GIBS VIIRS true colour dated by the case", () => {
    const s = byId("satellite", "2026-10-12");
    const sat = s["tp-basemap-satellite"];
    expect(sat.on).toBe(true);
    expect(sat.tiles).toEqual([
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/2026-10-12/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg",
    ]);
    expect(sat.tileSize).toBe(256);
    expect(sat.maxzoom).toBe(9); // tile-set edge; the map overzooms beyond it
    expect(sat.attribution).toContain("NASA GIBS");
    expect(s["tp-basemap-streets"].on).toBe(false);
    // Imagery is dark underneath -> the dark (light-text) labels set.
    expect(s["tp-basemap-labels-dark"].on).toBe(true);
    expect(s["tp-basemap-labels-dark"].top).toBe(true);
    expect(s["tp-basemap-labels-light"].on).toBe(false);
  });

  test("streets: CARTO voyager nolabels + matching labels", () => {
    const s = byId("streets");
    expect(s["tp-basemap-streets"].on).toBe(true);
    expect(s["tp-basemap-streets"].tiles[0]).toContain("voyager_nolabels");
    expect(s["tp-basemap-streets"].tiles).toHaveLength(4); // a-d subdomains
    expect(s["tp-basemap-satellite"].on).toBe(false);
    expect(s["tp-basemap-labels-light"].on).toBe(true);
    expect(s["tp-basemap-labels-light"].tiles[0]).toContain("voyager_only_labels");
    expect(s["tp-basemap-labels-dark"].on).toBe(false);
  });

  test("dark: no raster underlay; the dark labels set stays on", () => {
    const s = byId("dark");
    expect(s["tp-basemap-satellite"].on).toBe(false);
    expect(s["tp-basemap-streets"].on).toBe(false);
    expect(s["tp-basemap-labels-dark"].on).toBe(true);
    expect(s["tp-basemap-labels-dark"].tiles[0]).toContain("dark_only_labels");
  });

  test("imagery date: live/invalid -> 'default' (latest published)", () => {
    for (const bad of [undefined, "", "2026-1-1", "today"]) {
      expect(byId("satellite", bad)["tp-basemap-satellite"].tiles[0]).toContain("/default/default/");
    }
  });

  test("underlays carry no 'top' flag; labels do", () => {
    for (const b of BASEMAP_ORDER) {
      const s = basemapSources(b);
      expect(s.filter((x) => x.top).map((x) => x.id)).toEqual([
        "tp-basemap-labels-dark",
        "tp-basemap-labels-light",
      ]);
      expect(s.filter((x) => !x.top).map((x) => x.id)).toEqual([
        "tp-basemap-satellite",
        "tp-basemap-streets",
      ]);
    }
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
