// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { bundle, frame, liveBundle, manifest, point, series, zones } from "./model/fixtures";
import { caseHazard, initialState, linkParams, reduce, type Action, type ScreenState, FEATURED_BASEMAP } from "./state";
import { zone } from "./model/fixtures";
import { layerRows } from "./model/layerRegistry";
import { statusChip } from "./model/status";
import { issuedFrame, issueLeadsFor, mapCaption, stepsFor } from "./model/steps";
import { criticalAreaTile, peopleTile } from "./model/tiles";
import { priorityAreas } from "./model/areas";
import { radarCard } from "./model/radar";

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

// Now with a published NISAR pair and its flood candidate polygons.
const nowPair = liveBundle({
  manifest: manifest([frame("tpi_slide", "2026-11-15")]),
  data_dates: { nisar_pre: "2026-10-25T21:16:03Z", nisar_post: "2026-11-06T21:16:03Z" },
  products: { flood_confirmed: "response/flood_nisar.geojson" },
  response: { source: "nisar-gcov", flooded_km2: 12.06 },
});

describe("Now radar default (L27)", () => {
  test("Now with a NISAR pair opens with the flood candidates on, next to the TPI index", () => {
    expect(initialState([wa, rs, nowPair]).layers).toEqual(["tpi", "flood"]);
  });
  test("switching back to Now turns them on; replay and Now without a pair do not", () => {
    const c = [wa, rs, nowPair];
    const s = initialState(c, "wa_2025");
    expect(s.layers).toEqual(["tpi"]);
    expect(reduce(s, { type: "selectCase", id: "now" }, c).layers).toEqual(["tpi", "flood"]);
    expect(initialState([wa, rs, now]).layers).toEqual([]);
  });
  test("the user can still turn them off", () => {
    const c = [nowPair];
    const s = reduce(initialState(c), { type: "toggleLayer", id: "flood" }, c);
    expect(s.layers).toEqual(["tpi"]);
  });
});

describe("live summary v2 in the tile and status", () => {
  test("Critical area and 'reached' read the Crítico class of the hazard", () => {
    const v2 = liveBundle({ manifest: manifest([frame("tpi_flood", "2026-11-15")]),
      summary: { critical_km2: { slide: 12, flood: 130, any: 140 },
        classes_km2: { landslide: { Baixo: 1, Alto: 12, Crítico: 0 }, flood: { Baixo: 1, Alto: 100, Crítico: 30 } } } as never });
    expect(criticalAreaTile(v2, "flood").value).toBe("30.0 km²");
    expect(criticalAreaTile(v2, "slide").value).toBe("0.0 km²");
    expect(statusChip(v2, stepsFor(v2), 0, "slide").kind).toBe("below");
    expect(statusChip(v2, stepsFor(v2), 0, "flood").kind).toBe("reached");
  });
});

describe("Now today frame: partly forecast caption", () => {
  test("caption and layer row say observed to yesterday + NOAA GFS for today", () => {
    const live = liveBundle({ manifest: manifest([frame("tpi_flood", "2026-11-15")]),
      data_dates: { imerg_obs_through: "2026-11-14", forecast_from: "2026-11-15", gfs_issued: "2026-11-15T00:00:00Z" } });
    const steps = stepsFor(live);
    const cap = mapCaption(live, steps, 0, "flood", ["tpi"]);
    expect(cap).toEqual({ text: "Flood TPI · Today · observed to Nov 14 + NOAA GFS forecast for Nov 15 (partly forecast)", forecast: true });
    expect(layerRows(live, ["tpi"], "flood", "2026-11-15").find((r) => r.id === "tpi")?.sub)
      .toBe("Today · observed to Nov 14 + NOAA GFS forecast for Nov 15 (partly forecast)");
  });
});

describe("caption keeps the issue time in the layer row only", () => {
  test("lead-live basis_label without '(issued …)' on the map caption", () => {
    const live = liveBundle({
      manifest: { ...manifest([]), layers: [{ id: "tpi_flood_d0", date: "2026-11-15", png: "x.png", forecast: true, partly_forecast: true,
        basis_label: "observed to Nov 14 + NOAA GFS forecast for Nov 15 (issued 2026-11-15 00:00 UTC)" }] } as never,
      data_dates: { forecast_from: "2026-11-15" },
    });
    expect(mapCaption(live, stepsFor(live), 0, "flood", ["tpi"]).text)
      .toBe("Flood TPI · Today · observed to Nov 14 + NOAA GFS forecast for Nov 15 (partly forecast)");
    expect(layerRows(live, ["tpi"], "flood", "2026-11-15").find((r) => r.id === "tpi")?.sub).toContain("(issued 2026-11-15 00:00 UTC)");
  });
});

describe("replay: forecast issued this day (beat 2)", () => {
  const gfs = (hz: string, k: number, issued: string, date: string) => ({
    id: `tpi_${hz}_gfs_d${k}`, date, issued, png: `wa_2025/png/tpi_${hz}_gfs_d${k}_${date.replace(/-/g, "")}.png`,
    forecast: true, forecast_source: "noaa-gfs", kind: "forecast" });
  const waG = bundle({
    series: series([0, 0, 0, 0.97, 1], ["observed", "observed", "observed", "observed", "observed"], 0.6, 4),
    manifest: { ...manifest([frame("tpi_flood", "2025-12-10"), frame("tpi_slide", "2025-12-10")]),
      layers: [frame("tpi_flood", "2025-12-10"), frame("tpi_slide", "2025-12-10"),
        gfs("slide", 3, "2025-12-03", "2025-12-06"), gfs("slide", 1, "2025-12-05", "2025-12-06"),
        gfs("slide", 1, "2025-12-11", "2025-12-12")] } as never,
  });

  test("the frame of the run issued that day for D+k; never a run issued after the event day", () => {
    expect(issuedFrame(waG, "2025-12-03", "slide", 3)?.layer.date).toBe("2025-12-06");
    expect(issuedFrame(waG, "2025-12-03", "slide", 1)).toBeUndefined();
    expect(issuedFrame(waG, "2025-12-11", "slide", 1)).toBeUndefined(); // after reference day
    expect(issueLeadsFor(waG, "2025-12-05", "slide")).toEqual([1]);
    expect(issuedFrame(liveBundle(), "2025-12-05", "slide", 1)).toBeUndefined();
  });

  test("caption names the depicted day, the issue day and the lead", () => {
    const steps = [{ index: 0, date: "2025-12-03", offset: -7, kind: "observed", top: "Dec 3", sub: "D-7", forecast: false }] as never;
    expect(mapCaption(waG, steps, 0, "slide", ["tpi"], 3).text)
      .toBe("Landslide TPI · Dec 6, 2025 · forecast · NOAA GFS (issued Dec 3, 2025), 3 days ahead");
    expect(mapCaption(waG, steps, 0, "slide", ["tpi"], 1).text)
      .toBe("No NOAA GFS forecast issued Dec 3, 2025 for 1 day ahead");
  });

  test("Start here: one goTo sets case, day, hazard and the forecast lead (beat 2)", () => {
    const c = [waG, nowPair];
    const start = initialState(c);
    expect(start.activeId).toBe("now");
    const day = stepsFor(waG)[1].date.slice(0, 10);
    const s = reduce(start, { type: "goTo", id: "wa_2025", day, hazard: "slide", lead: 3 }, c);
    expect(s).toMatchObject({ activeId: "wa_2025", hazard: "slide", issueLead: 3 });
    expect(stepsFor(waG)[s.dayIndex].date.slice(0, 10)).toBe(day);
    expect(s.layers).toContain("tpi");
    const back = reduce(reduce(s, { type: "toggleLayer", id: "flood" }, c), { type: "goTo", id: "now" }, c);
    expect(back).toMatchObject({ activeId: "now", issueLead: 0, layers: initialState(c).layers });
    expect(reduce(s, { type: "goTo", id: "nope" }, c)).toBe(s);
    // A stop without a day opens the case's own default step, even on the same case.
    expect(reduce(s, { type: "goTo", id: "wa_2025" }, c).dayIndex).toBe(initialState(c, "wa_2025").dayIndex);
  });

  test("choosing a lead turns the TPI index on; a case change resets it", () => {
    const c = [waG, nowPair];
    let s = reduce(initialState(c, "wa_2025"), { type: "toggleLayer", id: "tpi" }, c);
    expect(s.layers).not.toContain("tpi");
    s = reduce(s, { type: "setIssueLead", lead: 3 }, c);
    expect(s).toMatchObject({ issueLead: 3 });
    expect(s.layers).toContain("tpi");
    expect(reduce(s, { type: "selectCase", id: "now" }, c).issueLead).toBe(0);
  });

  test("arriving from a paused Now (flood only) opens the replay with the TPI index on", () => {
    const paused = { ...nowPair, riskPaused: true };
    const c = [waG, paused];
    const s = initialState(c);
    expect(s.layers).toEqual(["flood"]);
    expect(reduce(s, { type: "selectCase", id: "wa_2025" }, c).layers).toContain("tpi");
  });
});

describe("R3 zones and DSWx in Now", () => {
  const zoneFc = zones([
    { ...point(), properties: { name: "São Miguel Arcanjo", rank: 1, class: "High", tpi: null, sources: ["nisar-gcov"], area_km2: 7.5, people: 474 } },
    { ...point(), properties: { name: "Itaporanga", rank: 2, class: "Critical", tpi: 0.6, sources: ["tpi-critical"], area_km2: 30.2, people: 152 } },
  ] as never);
  const live = liveBundle({ zones: zoneFc, manifest: manifest([frame("tpi_slide", "2026-11-15")]),
    products: { flood_dswx: "response/flood_dswx.geojson" },
    responseSources: [{ source: "opera-dswx-s1", flooded_km2: 129.497, people_flooded: 494, latest_acquired: "2026-11-14T09:06:12Z" }] });

  test("observed-only municipalities read 'Observed flood', never a risk class", () => {
    const areas = priorityAreas(live);
    expect(areas.map((a) => [a.name, a.cls, a.tpi])).toEqual([
      ["São Miguel Arcanjo", "Observed flood", null],
      ["Itaporanga", "Critical", 0.6],
    ]);
  });

  test("paused: TPI-only municipalities are held back", () => {
    expect(priorityAreas({ ...live, riskPaused: true }).map((a) => a.name)).toEqual(["São Miguel Arcanjo"]);
  });

  test("DSWx alone makes the flood layer available and on by default; card names it", () => {
    expect(initialState([live]).layers).toEqual(["tpi", "flood"]);
    const card = radarCard(live);
    expect(card.others).toEqual([{ label: "Also seen by NASA OPERA surface water (DSWx) (candidates)",
      value: "129.5 km² · 494 people (estimate) · newest pass Nov 14, 2026" }]);
    expect(card.canShowOnMap).toBe(true);
  });
});

describe("unverified live run: risk paused", () => {
  const paused = { ...nowPair, riskPaused: true,
    summary: { critical_km2: { slide: 0, flood: 1024, any: 1054 }, classes_km2: { Baixo: 1 } } } as typeof nowPair;

  test("the TPI layer cannot be on; the radar candidates stay", () => {
    expect(initialState([wa, rs, paused]).layers).toEqual(["flood"]);
    const s = reduce(initialState([paused]), { type: "toggleLayer", id: "tpi" }, [paused]);
    expect(s.layers).toEqual(["flood"]);
  });

  test("tiles, status and caption say paused; replays are untouched", () => {
    expect(criticalAreaTile(paused, "flood").value).toBe("paused while we verify today's data");
    expect(peopleTile(paused).value).toBe("paused while we verify today's data");
    expect(statusChip(paused, stepsFor(paused), 0, "flood")).toMatchObject({ kind: "no-data", label: "Risk paused" });
    expect(mapCaption(paused, stepsFor(paused), 0, "slide", ["flood"]).text)
      .toContain("Risk map paused while we verify today's data");
    expect(layerRows(paused, ["flood"], "slide").find((r) => r.id === "tpi"))
      .toMatchObject({ available: false, sub: "paused while we verify today's data" });
    expect(initialState([{ ...wa, riskPaused: false }]).layers).toEqual(["tpi"]);
  });
});

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

test("L52 setView: one tap sets the view's layer set; a view without data changes nothing", async () => {
  const { reduce, initialState } = await import("./state");
  const { bundle: mk, frame } = await import("./model/fixtures");
  void frame;
  const b = mk({ id: "rs_2024", mode: "replay" });
  const s0 = initialState([b]);
  const s1 = reduce(s0, { type: "setView", view: "radar" }, [b]);
  // no flood layer in this fixture: unchanged
  expect(s1.layers).toEqual(s0.layers);
});

describe("basemap (L52)", () => {
  const uy = bundle({ id: "rs_uruguai_2026" }); // the featured replay

  test("Dark by default; the featured replay opens on FEATURED_BASEMAP", () => {
    expect(initialState([wa]).basemap).toBe("dark");
    expect(initialState([uy]).basemap).toBe(FEATURED_BASEMAP);
    // Now stays the opening screen when loaded — on Dark.
    expect(initialState([uy, now]).basemap).toBe("dark");
    expect(initialState([uy, now], "rs_uruguai_2026").basemap).toBe(FEATURED_BASEMAP);
  });

  test("the ?basemap= deep link wins over the case default", () => {
    expect(initialState([uy], "rs_uruguai_2026", undefined, { basemap: "streets" }).basemap).toBe("streets");
    expect(initialState([wa], undefined, undefined, { basemap: "satellite" }).basemap).toBe("satellite");
    expect(initialState([wa], undefined, undefined, { basemap: "bogus" }).basemap).toBe("dark");
  });

  test("setBasemap switches; a case change resets to the case default", () => {
    const c = [uy, wa];
    let s = initialState(c, "rs_uruguai_2026");
    s = reduce(s, { type: "setBasemap", basemap: "streets" }, c);
    expect(s.basemap).toBe("streets");
    s = reduce(s, { type: "selectCase", id: "wa_2025" }, c);
    expect(s.basemap).toBe("dark");
    s = reduce(s, { type: "selectCase", id: "rs_uruguai_2026" }, c);
    expect(s.basemap).toBe(FEATURED_BASEMAP);
  });

  test("a goTo stop lands on the case default too", () => {
    const c = [uy, wa];
    const s = reduce(initialState(c, "wa_2025"), { type: "goTo", id: "rs_uruguai_2026" }, c);
    expect(s.basemap).toBe(FEATURED_BASEMAP);
  });
});
