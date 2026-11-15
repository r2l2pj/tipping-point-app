// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { CaseBundle, ManifestLayer } from "../lib/types";
import {
  LONG_RANGE_NOTE,
  probFrame,
  probHorizonsAvailable,
  type ProbHorizon,
} from "../lib/layers";
import LayersPanel from "./LayersPanel";
import type { LayerState } from "./MapLayers";

const frame = (h: string, date: string): ManifestLayer => ({
  id: `p_trigger_${h}`,
  date,
  png: `rs_2024/png/p_trigger_${h}_${date.replaceAll("-", "")}.png`,
  issued_at: "2024-05-02T00:00:00Z",
  forecast_source: "noaa-gfs",
});

const ALL: ManifestLayer[] = ["24h", "48h", "72h", "7d", "14d"].flatMap((h) => [
  frame(h, "2024-05-02"),
  frame(h, "2024-05-03"),
]);

const layers: LayerState = {
  tpiFlood: false, tpiSlide: true, imerg: false, smap: false, nisar: false, pTrigger: true,
};

const panel = (ls: ManifestLayer[], h: ProbHorizon) =>
  renderToStaticMarkup(
    <LayersPanel
      layers={layers}
      onToggle={() => {}}
      bundle={{ id: "rs_2024", title: "RS", mode: "replay", manifest: { event: "rs_2024", layers: ls } } as CaseBundle}
      budget={2}
      frameDate="2024-05-03"
      probHorizon={h}
      onProbHorizon={() => {}}
    />
  );

describe("P(trigger) horizons (L27)", () => {
  test("available horizons follow the manifest, in display order", () => {
    expect(probHorizonsAvailable(ALL)).toEqual(["24h", "48h", "72h", "7d", "14d"]);
    expect(probHorizonsAvailable([frame("72h", "2024-05-02"), frame("24h", "2024-05-02")])).toEqual(["24h", "72h"]);
    expect(probHorizonsAvailable([{ id: "tpi_slide", date: "2024-05-02", png: "x.png" }])).toEqual([]);
  });

  test("probFrame picks the horizon and the day; 14d never matches 14d-less ids", () => {
    expect(probFrame(ALL, "7d", "2024-05-03")?.png).toContain("p_trigger_7d_20240503");
    expect(probFrame(ALL, "24h", "2024-05-02")?.id).toBe("p_trigger_24h");
    expect(probFrame([frame("24h", "2024-05-02")], "14d", "2024-05-02")).toBeUndefined();
    // legacy single family (no horizon ids) still resolves
    expect(probFrame([{ id: "p_trigger", date: "2024-05-02", png: "p.png" }], "24h", "2024-05-02")?.id).toBe("p_trigger");
  });

  test("selector lists every horizon; short horizons carry no long-range note", () => {
    const html = panel(ALL, "24h");
    for (const l of [">24 h<", ">48 h<", ">72 h<", ">7 d<", ">14 d<"]) expect(html).toContain(l);
    expect(html).toContain('aria-checked="true"');
    expect(html).not.toContain(LONG_RANGE_NOTE);
  });

  test("7 d and 14 d show the visible 'lower confidence: long-range forecast' note", () => {
    for (const h of ["7d", "14d"] as const) {
      expect(panel(ALL, h)).toContain("lower confidence: long-range forecast");
    }
    expect(panel(ALL, "72h")).not.toContain("lower confidence");
  });

  test("no probability rasters -> no row, no selector", () => {
    const html = panel([{ id: "tpi_slide", date: "2024-05-03", png: "s.png" }], "24h");
    expect(html).not.toContain("Probability horizon");
    expect(html).not.toContain(">24 h<");
  });
});
