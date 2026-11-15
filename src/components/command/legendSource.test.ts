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

import { tourStops } from "./StartHere";
import { bundle, liveBundle } from "./model/fixtures";
describe("Start here stops", () => {
  test("L42: NISAR first and largest, then the live NISAR card, RS, the WA forecast; event ids resolve", () => {
    const stops = tourStops([bundle({ id: "wa-2025-12" }), bundle({ id: "rs_2024" }), liveBundle()]);
    expect(stops.map((s) => s.key)).toEqual(["wa-radar", "now", "rs", "wa"]);
    expect(stops[0]).toMatchObject({ primary: true, title: "1 · Washington, Dec 2025 — NISAR radar",
      action: { id: "wa-2025-12", hazard: "flood", compare: "radar" } });
    expect(stops[0].what).toBe("NISAR radar sees the flood through cloud: swipe before / after");
    expect(stops[1].title).toBe("2 · Now — Southern Brazil, NISAR radar");
    expect(stops[3].action).toMatchObject({ id: "wa-2025-12", day: -7, hazard: "slide", lead: 3 });
  });
  test("HH | HV and the time series are named only when published", () => {
    const wa = bundle({ id: "wa_2025", nisarSeries: { dates: ["a", "b"], areas: {} },
      manifest: { ...bundle().manifest!, layers: [...(bundle().manifest?.layers ?? []), { id: "nisar_hv_pre", png: "x.png" }] } } as never);
    expect(tourStops([wa])[0].what).toBe("NISAR radar sees the flood through cloud: swipe before / after, switch HH | HV, then see the radar time series");
  });
});

describe("Uruguay River flood as the main case (rs_uruguai_2026)", () => {
  test("listed first, opened by default (before Now), tour stop #1; ?case= still wins", async () => {
    const { featuredFirst, initialState } = await import("./state");
    const uy = bundle({ id: "rs_uruguai_2026", title: "Uruguay River flood, Oct–Nov 2026", manifest: { event: "rs_uruguai_2026", layers: [] } } as never);
    const wa = bundle({ id: "wa_2025" });
    const live = liveBundle();
    const cases = featuredFirst([wa, live, uy]);
    expect(cases.map((c) => c.id)).toEqual(["rs_uruguai_2026", "wa_2025", "now"]);
    expect(initialState(cases).activeId).toBe("rs_uruguai_2026");
    expect(initialState(cases, "wa_2025").activeId).toBe("wa_2025");
    const stops = tourStops(cases);
    expect(stops[0]).toMatchObject({ key: "uy-radar", primary: true, title: "1 · Uruguay River flood, Oct–Nov 2026 — NISAR radar" });
    expect(stops.find((s) => s.key === "wa-radar")!.primary).toBe(false);
    // without it: unchanged (Now first, WA radar primary)
    expect(initialState(featuredFirst([wa, live])).activeId).toBe("now");
  });
});
