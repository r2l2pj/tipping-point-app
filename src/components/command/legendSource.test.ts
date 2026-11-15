import { describe, expect, test } from "bun:test";
import { legendSource } from "./LayersColumn";

describe("legend source line (rule 3)", () => {
  test("names the NASA sources, the unit and the frame date", () => {
    expect(legendSource("2024-05-02")).toBe("TPI 0–1 from NASA GPM IMERG rain, SMAP soil moisture and NASADEM terrain · May 2, 2024");
    expect(legendSource()).not.toContain("·");
  });
});

import { NO_MAP_LAYER_TEXT, visibleLayerRows } from "./model/layerRegistry";
describe("dead toggles (judge #6)", () => {
  test("'no map layer for this case' rows are hidden; other unavailable reasons stay", () => {
    const rows = [
      { id: "tpi", available: true, sub: "data May 2, 2024" },
      { id: "imerg", available: false, sub: NO_MAP_LAYER_TEXT },
      { id: "tpi2", available: false, sub: "paused: run not verified" },
      { id: "flood", available: false, sub: "not published yet · NISAR passes: Nov 6" },
    ];
    expect(visibleLayerRows(rows).map((r) => r.id)).toEqual(["tpi", "tpi2", "flood"]);
  });
});
