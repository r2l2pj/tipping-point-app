// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { LONG_RANGE_NOTE, type ProbHorizon } from "@/lib/layers";
import LayersColumn from "./LayersColumn";
import { bundle, frame, manifest } from "./model/fixtures";
import { layerRows, type LayerId } from "./model/layerRegistry";
import type { CcBundle } from "./model/types";

const noop = () => {};

const ALL = ["24h", "48h", "72h", "7d", "14d"].map((h) => frame(`p_trigger_${h}`, "2025-12-10"));
const prob = bundle({ manifest: manifest([frame("tpi_slide", "2025-12-10"), ...ALL]) });

const column = (b: CcBundle, on: LayerId[], h: ProbHorizon = "24h") =>
  renderToStaticMarkup(
    <LayersColumn
      bundle={b}
      rows={layerRows(b, on, "slide", "2025-12-10")}
      hazard="slide"
      layers={on}
      notice={null}
      probHorizon={h}
      stepDate="2025-12-10"
      onHazard={noop}
      onToggle={noop}
      onProbHorizon={noop}
      onClose={noop}
    />
  );

describe("P(trigger) row and horizon selector", () => {
  test("the selector lists only the horizons the case ships", () => {
    const html = column(prob, ["ptrigger"]);
    expect(html).toContain("Model probability (XGBoost)");
    expect(html).toContain('aria-label="Probability horizon"');
    for (const l of [">24 h<", ">48 h<", ">72 h<", ">7 d<", ">14 d<"]) expect(html).toContain(l);
    expect(html).toContain('aria-checked="true"');
    const partial = column(
      bundle({ manifest: manifest([frame("p_trigger_48h", "2025-12-10")]) }),
      ["ptrigger"],
      "48h"
    );
    expect(partial).toContain(">48 h<");
    expect(partial).not.toContain(">24 h<");
    expect(partial).not.toContain(">7 d<");
  });

  test("7 d and 14 d carry the visible long-range note; short horizons do not", () => {
    for (const h of ["7d", "14d"] as const) expect(column(prob, ["ptrigger"], h)).toContain(LONG_RANGE_NOTE);
    for (const h of ["24h", "48h", "72h"] as const)
      expect(column(prob, ["ptrigger"], h)).not.toContain(LONG_RANGE_NOTE);
  });

  test("without p_trigger frames the row is unavailable and there is no selector", () => {
    const html = column(bundle({ manifest: manifest([frame("tpi_slide", "2025-12-10")]) }), []);
    expect(html).toContain("Model probability (XGBoost)");
    expect(html).not.toContain("Probability horizon");
    expect(html).not.toContain(">24 h<");
  });

  test("a legacy single p_trigger family is available but has no horizon selector", () => {
    const html = column(bundle({ manifest: manifest([frame("p_trigger", "2025-12-10")]) }), ["ptrigger"]);
    expect(html).toContain("Model probability (XGBoost)");
    expect(html).not.toContain("Probability horizon");
    expect(html).not.toContain(">24 h<");
  });
});
