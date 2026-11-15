import { describe, expect, test } from "bun:test";
import { geoPaint, GEO_COLORS } from "./mapColors";

describe("geographic basemap colours", () => {
  test("water is blue, vegetation green, land an earth tone; other layers keep the style", () => {
    expect(geoPaint({ id: "background", type: "background" })).toEqual(["background-color", GEO_COLORS.land]);
    expect(geoPaint({ id: "water", type: "fill", "source-layer": "water" })).toEqual(["fill-color", GEO_COLORS.water]);
    expect(geoPaint({ id: "waterway", type: "line", "source-layer": "waterway" })).toEqual(["line-color", GEO_COLORS.river]);
    expect(geoPaint({ id: "landcover", type: "fill", "source-layer": "landcover" })).toEqual(["fill-color", GEO_COLORS.vegetation]);
    expect(geoPaint({ id: "park", type: "fill", "source-layer": "park" })).toEqual(["fill-color", GEO_COLORS.vegetation]);
    // CARTO tiles: rivers and lakes share `water`; woods and parks share `landuse`.
    expect(geoPaint({ id: "waterway", type: "line", "source-layer": "water" })).toEqual(["line-color", GEO_COLORS.river]);
    expect(geoPaint({ id: "water_shadow", type: "fill", "source-layer": "water" })).toBeUndefined();
    expect(geoPaint({ id: "landcover", type: "fill", "source-layer": "landuse" })).toEqual(["fill-color", GEO_COLORS.vegetation]);
    expect(geoPaint({ id: "park_national_park", type: "fill", "source-layer": "landuse" })).toEqual(["fill-color", GEO_COLORS.vegetation]);
    expect(geoPaint({ id: "landuse", type: "fill", "source-layer": "landuse" })).toEqual(["fill-color", GEO_COLORS.land]);
    expect(geoPaint({ id: "landuse_residential", type: "fill", "source-layer": "landuse" })).toBeUndefined();
    expect(geoPaint({ id: "road", type: "line", "source-layer": "transportation" })).toBeUndefined();
    expect(geoPaint({ id: "water-name", type: "symbol", "source-layer": "water" })).toBeUndefined();
  });
});
