// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { bundle, frame, liveBundle, manifest, point, series, zones } from "./model/fixtures";
import { caseHazard, initialState, linkParams, reduce, type Action, type ScreenState } from "./state";
import { zone } from "./model/fixtures";

const fc = (n: number) => zones(Array.from({ length: n }, () => point()));
const wa = bundle({
  series: series([0.1, 0.2, 0.9, 0.9], ["observed", "observed", "observed", "forecast"], 0.6, 2),
  manifest: manifest([frame("tpi_slide", "2025-12-12"), frame("tpi_flood", "2025-12-12"), frame("imerg_x", "2025-12-12")]),
  flood: fc(1),
});
const rs = bundle({
  id: "rs_2024",
  series: series([0.1, 0.9], [], 0.6, 1),
  manifest: manifest([frame("tpi_flood", "2025-12-11")]),
});
const now = liveBundle();
const cases = [wa, rs, now];

const run = (state: ScreenState, ...actions: Action[]) =>
  actions.reduce((s, a) => reduce(s, a, cases), state);

describe("initial state", () => {
  test("opens on Now when a live case is loaded, else on the first case", () => {
    expect(initialState(cases)).toMatchObject({ activeId: "now", dayIndex: 0, playing: false, layers: [] });
    expect(initialState([wa, rs])).toMatchObject({ activeId: "wa_2025", dayIndex: 2, hazard: "slide", layers: ["tpi"] });
    expect(initialState([]).activeId).toBe("");
  });

  test("a ?case= deep link opens that case, by id or alias", () => {
    expect(initialState(cases, "rs_2024")).toMatchObject({ activeId: "rs_2024", lastReplayId: "rs_2024", dayIndex: 1 });
    expect(initialState(cases, "wa-2025-12").activeId).toBe("wa_2025");
    expect(initialState(cases, "unknown").activeId).toBe("now");
    // ?day=<offset> picks the step with that offset; unknown falls back.
    expect(initialState(cases, "wa_2025", -1).dayIndex).toBe(1);
    expect(initialState(cases, "wa_2025", 99).dayIndex).toBe(2);
    expect(initialState(cases, "wa_2025", NaN).dayIndex).toBe(2);
    // The link value is text: an offset, or the date of a step.
    expect(initialState(cases, "wa_2025", "-1").dayIndex).toBe(1);
    expect(initialState(cases, "wa_2025", wa.series!.days[3].date).dayIndex).toBe(3);
    expect(initialState(cases, "wa_2025", "abc").dayIndex).toBe(2);
    expect(initialState(cases, "wa_2025", "1900-01-01").dayIndex).toBe(2);
  });

  test("the address names the replay case, and the step when it is not the opening step", () => {
    expect(linkParams(now, 0)).toEqual({});
    expect(linkParams(undefined, 0)).toEqual({});
    expect(linkParams(wa, 2)).toEqual({ case: "wa_2025", day: undefined });
    expect(linkParams(wa, 1)).toEqual({ case: "wa_2025", day: "-1" });
    expect(linkParams(wa, 3)).toEqual({ case: "wa_2025", day: "1" });
    // A link made this way opens the same step.
    expect(initialState(cases, "wa_2025", linkParams(wa, 3).day).dayIndex).toBe(3);
  });
});

describe("case change", () => {
  const start = initialState(cases);

  test("Replay selects the last replay viewed; the first time, the first one", () => {
    const s = run(start, { type: "setMode", mode: "replay" });
    expect(s).toMatchObject({ activeId: "wa_2025", lastReplayId: "wa_2025" });
    const back = run(s, { type: "selectCase", id: "rs_2024" }, { type: "setMode", mode: "now" }, { type: "setMode", mode: "replay" });
    expect(back.activeId).toBe("rs_2024");
  });

  test("the step moves to the event day and playback does not start", () => {
    const s = run(start, { type: "selectCase", id: "wa_2025" });
    expect(s).toMatchObject({ dayIndex: 2, playing: false });
    expect(run(s, { type: "togglePlay" }, { type: "selectCase", id: "rs_2024" })).toMatchObject({ dayIndex: 1, playing: false });
  });

  test("selection, comparison and details close; panel preferences stay", () => {
    const open = run(start, { type: "selectCase", id: "wa_2025" }, { type: "selectArea", rank: 3 },
      { type: "toggleCallout" }, { type: "openCompare", kind: "radar" }, { type: "toggleDetails" },
      { type: "toggleTable" }, { type: "toggleList" }, { type: "toggleLayersOpen" });
    expect(open).toMatchObject({ selectedArea: 3, calloutExpanded: true, compareOpen: "radar", detailsOpen: true });
    const s = run(open, { type: "selectCase", id: "rs_2024" });
    expect(s).toMatchObject({
      selectedArea: null, calloutExpanded: false, compareOpen: null, detailsOpen: false,
      chartAsTable: true, listExpanded: true, layersOpen: false,
    });
  });

  test("the hazard is kept if the case has it, else the other", () => {
    const s = run(start, { type: "selectCase", id: "wa_2025" });
    expect(s.hazard).toBe("slide");
    expect(run(s, { type: "selectCase", id: "rs_2024" }).hazard).toBe("flood");
    expect(run(s, { type: "setHazard", hazard: "flood" }, { type: "selectCase", id: "rs_2024" }).hazard).toBe("flood");
  });

  test("layers the new case lacks are dropped; the TPI index stays the default", () => {
    const s = run(start, { type: "selectCase", id: "wa_2025" }, { type: "toggleLayer", id: "flood" });
    expect(s.layers).toEqual(["tpi", "flood"]);
    expect(run(s, { type: "selectCase", id: "rs_2024" }).layers).toEqual(["tpi"]);
    expect(run(s, { type: "toggleLayer", id: "tpi" }, { type: "selectCase", id: "rs_2024" }).layers).toEqual(["tpi"]);
    expect(run(s, { type: "selectCase", id: "now" }).layers).toEqual([]);
  });
});

describe("hazard a case opens on", () => {
  const both = manifest([frame("tpi_slide", "2025-12-10"), frame("tpi_flood", "2025-12-10")]);
  const floodEvent = bundle({ id: "rs_2024", manifest: both, series: series([0.9]),
    zones: zones([zone(1, { hazard: "flood" }), zone(2, { hazard: "flood" }), zone(3, { hazard: "landslide" })]) });
  const slideEvent = bundle({ manifest: both, series: series([0.9]),
    zones: zones([zone(1, { hazard: "landslide" })]) });

  test("the hazard most priority zones name, when the case has that raster", () => {
    expect(caseHazard(floodEvent)).toBe("flood");
    expect(caseHazard(slideEvent)).toBe("slide");
    expect(caseHazard(bundle({ manifest: both }))).toBeUndefined();
    expect(caseHazard({ ...floodEvent, manifest: manifest([frame("tpi_slide", "2025-12-10")]) })).toBeUndefined();
  });

  test("a flood event opens on the flood raster, not on the landslide one", () => {
    expect(initialState([floodEvent]).hazard).toBe("flood");
    const s = reduce(initialState([slideEvent, floodEvent]), { type: "selectCase", id: "rs_2024" }, [slideEvent, floodEvent]);
    expect(s.hazard).toBe("flood");
  });
});

describe("time", () => {
  const start = run(initialState(cases), { type: "selectCase", id: "wa_2025" });

  test("play advances one step at a time and stops at the last step", () => {
    let s = run(start, { type: "seek", index: 1 }, { type: "togglePlay" });
    expect(s.playing).toBe(true);
    s = run(s, { type: "tick" });
    expect(s).toMatchObject({ dayIndex: 2, playing: true });
    s = run(s, { type: "tick" });
    expect(s).toMatchObject({ dayIndex: 3, playing: false });
    expect(run(s, { type: "tick" })).toBe(s);
  });

  test("play from the last step starts again at the first", () => {
    expect(run(start, { type: "seek", index: 3 }, { type: "togglePlay" })).toMatchObject({ dayIndex: 0, playing: true });
  });

  test("a manual step, previous, next or an area selection pauses playback", () => {
    const playing = run(start, { type: "seek", index: 0 }, { type: "togglePlay" });
    for (const action of [{ type: "seek", index: 2 }, { type: "next" }, { type: "prev" }, { type: "selectArea", rank: 1 }] as Action[]) {
      expect(run(playing, action).playing).toBe(false);
    }
  });

  test("previous and next move one step and stay in range", () => {
    expect(run(start, { type: "next" }).dayIndex).toBe(3);
    expect(run(start, { type: "next" }, { type: "next" }).dayIndex).toBe(3);
    expect(run(start, { type: "seek", index: 0 }, { type: "prev" }).dayIndex).toBe(0);
    expect(run(start, { type: "seek", index: 99 }).dayIndex).toBe(3);
  });

  test("a case without steps cannot play", () => {
    expect(run(initialState(cases), { type: "togglePlay" }).playing).toBe(false);
  });
});

describe("layers", () => {
  const start = run(initialState(cases), { type: "selectCase", id: "wa_2025" });

  test("a third layer turns off the oldest and names it", () => {
    const s = run(start, { type: "toggleLayer", id: "imerg" }, { type: "toggleLayer", id: "flood" });
    expect(s.layers).toEqual(["imerg", "flood"]);
    expect(s.layerNotice).toBe("TPI index turned off to show Flood");
  });

  test("a row without data cannot be turned on", () => {
    expect(run(start, { type: "toggleLayer", id: "smap" })).toBe(start);
  });

  test("at most two data layers after any sequence of actions", () => {
    const actions: Action[] = [
      { type: "toggleLayer", id: "imerg" }, { type: "toggleLayer", id: "flood" }, { type: "confirmRadar" },
      { type: "toggleLayer", id: "tpi" }, { type: "selectCase", id: "rs_2024" }, { type: "toggleLayer", id: "catalog" },
      { type: "selectCase", id: "wa_2025" }, { type: "setHazard", hazard: "flood" }, { type: "toggleLayer", id: "imerg" },
    ];
    let s = start;
    for (let i = 0; i < 300; i++) {
      s = reduce(s, actions[(i * 7 + (i % 5)) % actions.length], cases);
      expect(s.layers.length).toBeLessThanOrEqual(2);
    }
  });

  test("'Confirm with NISAR radar' shows TPI plus flood and does not move the timeline", () => {
    const s = run(start, { type: "toggleLayer", id: "imerg" }, { type: "seek", index: 1 }, { type: "confirmRadar" });
    expect(s).toMatchObject({ layers: ["tpi", "flood"], dayIndex: 1, layerNotice: "Rain turned off to show Flood" });
    const noFlood = run(start, { type: "selectCase", id: "rs_2024" });
    expect(run(noFlood, { type: "confirmRadar" })).toBe(noFlood);
  });

  test("exactly one hazard at any time", () => {
    const s = run(start, { type: "setHazard", hazard: "flood" });
    expect(s.hazard).toBe("flood");
    expect(run(s, { type: "setHazard", hazard: "flood" })).toBe(s);
  });
});

describe("probability horizon", () => {
  // Ships 48h/72h frames only: the first published horizon is 48h.
  const probCase = bundle({
    id: "prob_1",
    series: series([0.5]),
    manifest: manifest([
      frame("tpi_slide", "2025-12-10"),
      frame("p_trigger_48h", "2025-12-10"),
      frame("p_trigger_72h", "2025-12-10"),
    ]),
  });
  const probCases = [wa, probCase, now];

  test("the default is the first horizon the case ships, else 24h", () => {
    expect(initialState([probCase]).probHorizon).toBe("48h");
    expect(initialState(cases).probHorizon).toBe("24h");
  });

  test("setProbHorizon sets the horizon", () => {
    const s = reduce(initialState(probCases), { type: "setProbHorizon", horizon: "14d" }, probCases);
    expect(s.probHorizon).toBe("14d");
  });

  test("a case change resets the horizon to the first one the new case ships", () => {
    const on72 = reduce(
      reduce(initialState(probCases), { type: "selectCase", id: "prob_1" }, probCases),
      { type: "setProbHorizon", horizon: "72h" },
      probCases
    );
    expect(on72.probHorizon).toBe("72h");
    const onWa = reduce(on72, { type: "selectCase", id: "wa_2025" }, probCases);
    expect(onWa.probHorizon).toBe("24h");
    expect(reduce(onWa, { type: "selectCase", id: "prob_1" }, probCases).probHorizon).toBe("48h");
  });
});

describe("area selection and comparison", () => {
  const start = run(initialState(cases), { type: "selectCase", id: "wa_2025" });

  test("the same row or pin again clears the selection; Esc clears it too", () => {
    const selected = run(start, { type: "selectArea", rank: 2 }, { type: "toggleCallout" });
    expect(selected).toMatchObject({ selectedArea: 2, calloutExpanded: true });
    expect(run(selected, { type: "selectArea", rank: 2 })).toMatchObject({ selectedArea: null, calloutExpanded: false });
    expect(run(selected, { type: "escape" }).selectedArea).toBeNull();
    expect(run(selected, { type: "selectArea", rank: 4 })).toMatchObject({ selectedArea: 4, calloutExpanded: false });
  });

  test("opening the comparison keeps the layers; closing restores the map", () => {
    const s = run(start, { type: "toggleLayer", id: "flood" }, { type: "openCompare", kind: "radar" });
    expect(s).toMatchObject({ compareOpen: "radar", layers: ["tpi", "flood"] });
    expect(run(s, { type: "closeCompare" })).toMatchObject({ compareOpen: null, layers: ["tpi", "flood"] });
    expect(run(s, { type: "selectArea", rank: 1 }, { type: "escape" })).toMatchObject({ compareOpen: null, selectedArea: 1 });
  });
});
