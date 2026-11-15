// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import NisarSeriesChart from "../NisarSeriesChart";
import { bundle, liveBundle, manifest } from "./fixtures";
import { radarCompare } from "./radar";
import { hypothesisLine, nisarSeriesView, slimHypothesis, slimNisarSeries } from "./nisarSeries";
import { radarCard } from "./radar";

// lead-analysis L42 schema (data/wa_2025/nisar_timeseries.json)
const raw = {
  dates: ["2025-11-10", "2025-12-04", "2025-12-16"],
  roles: { "2025-11-10": "reference (pre-season)", "2025-12-04": "pre-event", "2025-12-16": "post-event" },
  units: "dB (10·log10 of the linear-power mean)",
  areas: {
    control_forest: { label: "Forest (control)", hh_db: [-7.1, -7.0, -7.3], hv_db: [-13, -13.1, -13.2], hh_median_db: [0, 0, 0], n_px: 9, km2: 10, bbox: [0, 0, 1, 1] },
    flood_candidates: { label: "NISAR flood candidates", hh_db: [-9.5, -10.1, -16.8], hv_db: [-17, -17.5, null], n_px: 99, km2: 28 },
    broken: { label: "bad", hh_db: [1, 2] },
  },
  frames: [
    { date: "2025-11-10", layer_id: "nisar_ref", png: "wa_2025/png/nisar_ref_20251110.png", bounds: [0, 0, 1, 1] },
    { date: "2025-12-04", layer_id: "nisar_pre" },
    { date: "2025-12-16", layer_id: "nisar_post" },
  ],
  reading: { flood_candidates: "Candidates darkened by ~7 dB after the storm: consistent with open water." },
  geometry_note: "same track 172 D / frame 064, identical geometry",
  status: "candidates, never confirmed",
};

describe("NISAR time series (L42)", () => {
  const b = bundle({
    nisarSeries: slimNisarSeries(raw),
    manifest: manifest([
      { id: "nisar_pre", date: "2025-12-04", png: "wa_2025/png/nisar_pre.png", bounds: [-122, 47, -121, 48] },
      { id: "nisar_post", date: "2025-12-16", png: "wa_2025/png/nisar_post.png", bounds: [-122, 47, -121, 48] },
    ]),
  } as never);
  test("slim keeps aligned areas only; flood candidates first; frames resolve via manifest layers", () => {
    const v = nisarSeriesView(b)!;
    expect(v.lines.map((l) => l.id)).toEqual(["flood_candidates", "control_forest"]);
    expect(v.dates).toEqual(["Nov 10", "Dec 4", "Dec 16"]);
    expect(v.frames.map((f) => f.url)).toEqual([
      "/data/wa_2025/png/nisar_ref_20251110.png", "/data/wa_2025/png/nisar_pre.png", "/data/wa_2025/png/nisar_post.png"]);
    expect(v.frames[2].role).toBe("post-event");
    expect(v.min).toBeLessThan(-16.8);
  });
  test("the radar card carries it and renders the chart + strip; absent product -> nothing", () => {
    const card = radarCard(b);
    expect(card.series).toBeDefined();
    const html = renderToStaticMarkup(createElement(NisarSeriesChart, { s: card.series! }));
    expect(html).toContain("NISAR time series");
    expect(html).toContain("Candidates darkened by ~7 dB");
    expect(html).toContain("candidates, never confirmed");
    expect(html.match(/<img /g)).toHaveLength(3);
    expect(radarCard(bundle()).series).toBeUndefined();
    expect(slimNisarSeries({ dates: ["x"] })).toBeUndefined();
  });
});

describe("NISAR on the live Southern Brazil card (worker nisar-now-ts)", () => {
  test("series frames resolve under now/; HH | HV swipe from the now manifest layers", () => {
    const live = liveBundle({
      nisarSeries: slimNisarSeries({ ...raw, frames: [{ date: "2026-10-25", png: "response/png/nisar_pre.png" }, { date: "2026-11-06", png: "now/response/png/nisar_post.png" }] }),
      manifest: manifest([
        { id: "nisar_pre", date: "2026-10-25", png: "response/png/nisar_pre.png", bounds: [-58, -34, -48, -22.5] },
        { id: "nisar_post", date: "2026-11-06", png: "response/png/nisar_post.png", bounds: [-58, -34, -48, -22.5] },
        { id: "nisar_hv_pre", date: "2026-10-25", png: "response/png/nisar_hv_pre.png", bounds: [-58, -34, -48, -22.5] },
        { id: "nisar_hv_post", date: "2026-11-06", png: "response/png/nisar_hv_post.png", bounds: [-58, -34, -48, -22.5] },
      ], { event: undefined }), // the real now/manifest.json has no `event`
    } as never);
    const v = nisarSeriesView(live)!;
    expect(v.otherGeometry).toEqual([false, false, false]);
    expect(v.frames.map((f) => f.url)).toEqual(["/data/now/response/png/nisar_pre.png", "/data/now/response/png/nisar_post.png"]);
    const p = radarCompare(live).pair!;
    expect(p.before.url).toBe("/data/now/response/png/nisar_pre.png");
    expect(p.hv!.after.label).toBe("NISAR radar after (HV) — Nov 6, 2026");
    expect(radarCard(live).series).toBeDefined();
  });
});

test("t19n contract: reading_line wins, passes from other orbits are flagged", () => {
  const s = slimNisarSeries({ ...raw, reading_line: "Flood candidates darkened ~6 dB between Oct 25 and Nov 6.",
    passes: [{ date: "2025-12-04", track: 172, same_geometry: false }], geometry_note: "Oct 29/Nov 1 from other tracks" })!;
  const v = nisarSeriesView(bundle({ nisarSeries: s } as never))!;
  expect(v.reading).toBe("Flood candidates darkened ~6 dB between Oct 25 and Nov 6.");
  expect(v.otherGeometry).toEqual([false, true, false]);
  const html = renderToStaticMarkup(createElement(NisarSeriesChart, { s: v }));
  expect(html).toContain("Hollow points: passes from another orbit");
  expect(html).toContain("Oct 29/Nov 1 from other tracks");
});

test("L42 hypothesis line from lead-analysis nisar_hypothesis.json (supported only)", () => {
  const raw = { verdict: "supported", enrichment: { enrichment_missed_vs_detected: 8.562 },
    recall_by_group: { open: { recall: 0.2471 }, urban: { recall: 0.0343 }, forest: { recall: 0.0127 } } };
  const wa = bundle({ id: "wa_2025", nisarHypothesis: slimHypothesis(raw) } as never);
  expect(hypothesisLine(wa)).toBe("Test (WA Dec 2025): our misses are 8.6× more likely in towns and forest, where water doesn't turn dark — recall 25% in open fields vs 3% in towns.");
  expect(radarCard(wa).hypothesisLine).toBe(hypothesisLine(wa));
  expect(hypothesisLine(bundle({ nisarHypothesis: slimHypothesis({ ...raw, verdict: "not supported" }) } as never))).toBeUndefined();
  expect(hypothesisLine(bundle())).toBeUndefined();
});

describe("live NISAR finds nothing (conductor: R2 may publish 0 candidates)", () => {
  test("card says so with the pair dates, no NISAR zoom; tour stop 2 says so too", async () => {
    const { nisarNoFlood } = await import("./radar");
    const { tourStops } = await import("../StartHere");
    const live = liveBundle({
      response: { source: "nisar-gcov", flooded_km2: 0, polygons: 0, pre_acquired: "2026-10-25", post_acquired: "2026-11-06",
        null_reasons: { flooded_km2: "no new low-backscatter water on low ground in the latest pair" } },
      responseSources: [{ source: "nisar-gcov", flooded_km2: 0, features: 0 }],
    } as never);
    expect(nisarNoFlood(live)).toBe(true);
    const card = radarCard(live);
    expect(card.headline).toBe("No new flooding detected in the latest NISAR pass (Oct 25, 2026 → Nov 6, 2026)");
    expect(card.flooded!.value).toBe("none detected");
    expect(card.canShowOnMap).toBe(false);
    expect(card.note).toContain("no new low-backscatter water");
    expect(tourStops([live])[0].what).toContain("Latest NISAR pass: no new flooding detected");
    const some = liveBundle({ response: { source: "nisar-gcov", flooded_km2: 2.3 }, responseSources: [{ source: "nisar-gcov", flooded_km2: 2.3, features: 4 }] } as never);
    expect(nisarNoFlood(some)).toBe(false);
  });
});

describe("lead-analysis R2 status (nisar_meta.json)", () => {
  test("no_usable_pair: status_label as headline, 'not computed', no zoom, no old numbers", async () => {
    const { toNowResponse } = await import("@/lib/response");
    const { tourStops } = await import("../StartHere");
    const label = "No usable NISAR pair this pass — flood candidates not computed (pre/post acquisition modes differ (2005_DHDH_M vs 4005_DHDH_A): not comparable)";
    const live = liveBundle({ response: toNowResponse({ status: "no_usable_pair", status_label: label, pairs: [], flooded_km2: null }),
      data_dates: { nisar_pre: "2026-10-25", nisar_post: "2026-11-06" } } as never);
    const card = radarCard(live);
    expect(card.headline).toBe(label);
    expect(card.flooded!.value).toBe("not computed");
    expect(card.people).toBeUndefined();
    expect(card.canShowOnMap).toBe(false);
    expect(JSON.stringify(card)).not.toMatch(/2\.3 km²|\b82\b/);
    // the rejected pair's swipe and series are not shown as evidence
    expect(card.series).toBeUndefined();
    expect(card.compare.pair).toBeUndefined();
    expect(card.compare.reason).toBe("no comparable NISAR pair this pass");
    expect(tourStops([live])[0].what).toContain("no flood candidates (no usable pair)");
    expect(tourStops([live])[0].title).toBe("1 · Now — Southern Brazil");
  });
  test("no_new_flooding with dates; candidates -> normal card; no status + nothing computed -> reason", async () => {
    const { toNowResponse } = await import("@/lib/response");
    const fresh = liveBundle({ response: toNowResponse({ status: "no_new_flooding", status_label: "No new flooding detected this pass",
      pairs: [{ pre_acquired: "2026-11-06", post_acquired: "2026-11-18" }] }) } as never);
    expect(radarCard(fresh).headline).toBe("No new flooding detected this pass (Nov 6, 2026 → Nov 18, 2026)");
    const cands = liveBundle({ response: toNowResponse({ status: "candidates", flooded_km2: 4.2, n_polygons: 3 }) } as never);
    expect(radarCard(cands).headline).not.toContain("No ");
    const now = liveBundle({ response: toNowResponse({ pairs: [], flooded_km2: null,
      _null_reasons: { pairs: "every paired granule failed to read (see pair reasons)" } }) } as never);
    const c = radarCard(now);
    expect(c.headline).toBe("No NISAR flood candidates this pass");
    expect(c.note).toBe("every paired granule failed to read (see pair reasons).");
  });
});

describe("More NISAR products (kind 'nisar_extra')", () => {
  test("manifest-declared PNG with label, legend, attribution; hidden if none", async () => {
    const RadarCardC = (await import("../RadarCard")).default;
    const b = bundle({ manifest: manifest([
      { id: "nisar_pre", date: "2025-12-04", png: "wa_2025/png/nisar_pre.png", bounds: [-122, 47, -121, 48] },
      { id: "nisar_post", date: "2025-12-16", png: "wa_2025/png/nisar_post.png", bounds: [-122, 47, -121, 48] },
      { id: "nisar_coh_loss", kind: "nisar_extra", label: "NISAR coherence loss (Dec 4 → Dec 16)", png: "wa_2025/png/nisar_coh_loss.png",
        bounds: [-122, 47, -121, 48], date: "2025-12-16", legend: [{ label: "coherence loss", color: "#ff00ff" }],
        attribution: "NASA/JPL-Caltech NISAR", note: "candidates, never confirmed" },
    ]) } as never);
    const card = radarCard(b);
    expect(card.extras).toHaveLength(1);
    expect(card.extras[0].url).toBe("/data/wa_2025/png/nisar_coh_loss.png");
    const html = renderToStaticMarkup(createElement(RadarCardC, { radar: card, floodOn: false, compareOpen: false,
      onConfirm: () => {}, onShowFlood: () => {}, onCompare: () => {} } as never));
    expect(html).toContain("More NISAR products");
    expect(html).toContain("NISAR coherence loss (Dec 4 → Dec 16)");
    expect(html).toContain("NASA/JPL-Caltech NISAR");
    expect(radarCard(bundle()).extras).toEqual([]);
  });
});

describe("Uruguay: NISAR multi-date stack (kind 'nisar_frame')", () => {
  const frame = (date: string, pol: string) => ({ id: `nisar_${pol.toLowerCase()}_${date.replace(/-/g, "")}`, kind: "nisar_frame", date, polarization: pol,
    png: `rs_uruguai_2026/png/nisar_${pol.toLowerCase()}_${date.replace(/-/g, "")}.png`, bounds: [-57.25, -29.85, -56.45, -29.05] });
  test("stub stack (WA pair as 2 frames) + HV; frames-only case still gets a swipe; Passes from layer dates", () => {
    const uy = bundle({ id: "rs_uruguai_2026", data_dates: {}, manifest: { event: "rs_uruguai_2026", layers: [
      frame("2026-10-24", "HH"), frame("2026-10-24", "HV"), frame("2026-11-05", "HH"), frame("2026-11-05", "HV"), frame("2026-10-12", "HH"),
    ] } } as never);
    const p = radarCompare(uy).pair!;
    expect(p.stack!.dates).toEqual(["2026-10-12", "2026-10-24", "2026-11-05"]);
    expect(p.stack!.frames["2026-11-05"].HV!.label).toBe("NISAR radar HV — Nov 5, 2026");
    expect(p.before.url).toBe("/data/rs_uruguai_2026/png/nisar_hh_20261012.png");
    expect(p.after.url).toBe("/data/rs_uruguai_2026/png/nisar_hh_20261105.png");
    expect(radarCard(uy).dates).toBe("Oct 12, 2026 → Nov 5, 2026");
  });
  test("real v0 node: teammate pair layers (no data_dates) -> pair + Passes; no stack; no 'before NISAR launch'", () => {
    const uy = bundle({ id: "rs_uruguai_2026", data_dates: {}, products: { flood_confirmed: "rs_uruguai_2026/geojson/flood_confirmed.geojson" },
      manifest: { event: "rs_uruguai_2026", layers: [
        { id: "nisar_post", date: "2026-10-12", png: "rs_uruguai_2026/png/nisar_post_20261012.png", bounds: [-57.079983, -29.757373, -57.008572, -29.700131], kind: "observed" },
        { id: "nisar_pre", date: "2026-09-30", png: "rs_uruguai_2026/png/nisar_pre_20260930.png", bounds: [-57.079983, -29.757373, -57.008572, -29.700131], kind: "observed" },
      ] } } as never);
    const card = radarCard(uy);
    expect(card.headline).toBe("NISAR radar images available");
    expect(card.dates).toBe("Sep 30, 2026 → Oct 12, 2026");
    expect(card.compare.pair!.stack).toBeUndefined();
    expect(card.compare.pair!.before.label).toBe("NISAR radar before — Sep 30, 2026");
  });
});

describe("conductor blocker: 'NISAR' only for NISAR data (layer sensor field)", () => {
  const pairLayers = (sensor?: string) => [
    { id: "nisar_pre", date: "2026-09-30", png: "rs_uruguai_2026/png/nisar_pre_20260930.png", bounds: [-57.08, -29.76, -57.0, -29.7], ...(sensor ? { sensor } : {}) },
    { id: "nisar_post", date: "2026-10-12", png: "rs_uruguai_2026/png/nisar_post_20261012.png", bounds: [-57.08, -29.76, -57.0, -29.7], ...(sensor ? { sensor } : {}) },
  ];
  test("teammate pair 'unconfirmed (likely Sentinel-1)' -> 'Radar …' everywhere; flood 'radar, candidates'", async () => {
    const { tourStops } = await import("../StartHere");
    const uy = bundle({ id: "rs_uruguai_2026", data_dates: {}, metricsView: { flooded_km2: 1.817, flood_source: "radar" } as never,
      manifest: { event: "rs_uruguai_2026", layers: pairLayers("unconfirmed (likely Sentinel-1)") } } as never);
    const card = radarCard(uy);
    expect(card.nisar).toBe(false);
    expect(card.headline).toBe("Radar pair available — sensor unconfirmed (likely Sentinel-1)");
    expect(card.compare.pair!.before.label).toBe("Radar before — Sep 30, 2026");
    expect(card.flooded!.label).toBe("Flooded area (radar, candidates)");
    expect(card.limitation).toBeUndefined();
    expect(JSON.stringify(card)).not.toContain("NISAR radar");
    const stop = tourStops([uy])[0];
    expect(stop.title).toBe("1 · Untitled — radar".replace("Untitled", uy.title ?? "Uruguay River flood"));
    expect(stop.what).toMatch(/^Radar maps the river flood/);
  });
  test("sensor 'NISAR' or no field (WA) keeps NISAR wording; mixed stack -> 'Radar dates'", () => {
    const n = bundle({ id: "rs_uruguai_2026", data_dates: {}, manifest: { event: "rs_uruguai_2026", layers: pairLayers("NISAR") } } as never);
    expect(radarCard(n).headline).toBe("NISAR radar images available");
    expect(radarCard(n).compare.pair!.before.label).toBe("NISAR radar before — Sep 30, 2026");
    const f = (date: string, sensor: string) => ({ id: `f_${date}`, kind: "nisar_frame", date, polarization: "HH", png: `x/${date}.png`, sensor, bounds: [0, 0, 1, 1] });
    const mixed = bundle({ manifest: { event: "x", layers: [f("2026-10-12", "unconfirmed (likely Sentinel-1)"), f("2026-10-24", "NISAR"), f("2026-11-05", "NISAR")] } } as never);
    const st = radarCompare(mixed).pair!.stack!;
    expect(st.title).toBe("Radar dates");
    expect(st.frames["2026-10-12"].HH!.label).toBe("Radar HH — Oct 12, 2026");
    expect(st.frames["2026-11-05"].HH!.label).toBe("NISAR radar HH — Nov 5, 2026");
  });
});

test("lead-analysis 8212136: v0 renamed radar_pre/radar_post + sensor -> 'Radar' pair works", () => {
  const L = (id: string, date: string) => ({ id, date, png: `rs_uruguai_2026/png/${id}.png`, bounds: [-57.08, -29.76, -57.0, -29.7], sensor: "unconfirmed (likely Sentinel-1)", source: "teammate" });
  const uy = bundle({ id: "rs_uruguai_2026", data_dates: {}, metricsView: { flooded_km2: 1.817, flood_source: "radar" } as never,
    manifest: { event: "rs_uruguai_2026", layers: [L("radar_post", "2026-10-12"), L("radar_pre", "2026-09-30")] } } as never);
  const card = radarCard(uy);
  expect(card.pair).toBe(true);
  expect(card.headline).toBe("Radar pair available — sensor unconfirmed (likely Sentinel-1)");
  expect(card.dates).toBe("Sep 30, 2026 → Oct 12, 2026");
  expect(card.compare.pair!.before).toMatchObject({ url: "/data/rs_uruguai_2026/png/radar_pre.png", label: "Radar before — Sep 30, 2026" });
});

test("radar-only replay (Uruguay v0) opens with the flooded-area layer on", async () => {
  const { initialState } = await import("../state");
  const L = (id: string, date: string) => ({ id, date, png: `rs_uruguai_2026/png/${id}.png`, bounds: [-57.08, -29.76, -57.0, -29.7], sensor: "unconfirmed (likely Sentinel-1)" });
  const uy = bundle({ id: "rs_uruguai_2026", data_dates: {}, series: undefined, products: { flood_confirmed: "rs_uruguai_2026/geojson/flood_confirmed.geojson" },
    metricsView: { flooded_km2: 1.817, flood_source: "radar" } as never,
    manifest: { event: "rs_uruguai_2026", layers: [L("radar_post", "2026-10-12"), L("radar_pre", "2026-09-30")] } } as never);
  expect(initialState([uy]).layers).toEqual(["flood"]);
});

test("replay radar card shows people in the flooded area when published (Uruguay v0: 28)", () => {
  const uy = bundle({ id: "rs_uruguai_2026", metricsView: { flooded_km2: 1.817, people_flooded: 28, flood_source: "radar" } as never } as never);
  expect(radarCard(uy).people).toEqual({ label: "People in the flooded area (estimate)", value: "28" });
  expect(radarCard(bundle({ metricsView: { flooded_km2: 28 } as never } as never)).people).toBeUndefined();
});

test("lead-analysis 1665f79: 'NISAR (GCOV provisional)' -> NISAR wording, headline says provisional", () => {
  const L = (id: string, date: string) => ({ id, date, png: `rs_uruguai_2026/png/${id}.png`, bounds: [-57.08, -29.76, -57.0, -29.7], sensor: "NISAR (GCOV provisional)", source: "teammate" });
  const uy = bundle({ id: "rs_uruguai_2026", data_dates: {}, metricsView: { flooded_km2: 1.817, people_flooded: 28, flood_source: "nisar" } as never,
    manifest: { event: "rs_uruguai_2026", layers: [L("radar_post", "2026-10-12"), L("radar_pre", "2026-09-30")] } } as never);
  const card = radarCard(uy);
  expect(card.headline).toBe("NISAR radar images available");
  expect(card.compare.pair!.before.label).toBe("NISAR radar before — Sep 30, 2026");
  expect(card.flooded!.label).toBe("Flooded area (NISAR)");
});

test("Uruguay: tpi_replay_note replaces 'No frames published yet' (timeline, caption, status)", async () => {
  const { noStepsText, mapCaption } = await import("./steps");
  const note = "Local rain index not replayed for this case; local rain at Uruguaiana never reached its own P99 — the flood was driven by upstream-basin rain (see forecast_proof).";
  const uy = bundle({ id: "rs_uruguai_2026", series: undefined, metricsView: { tpi_replay_note: note } as never } as never);
  expect(noStepsText(uy)).toBe(note.replace("its own P99", "its extreme level").replace("(see forecast_proof)", "(see the upstream-rain test)")); // L42a: no file keys on screen
  expect(mapCaption(uy, [], 0, "flood", ["flood"]).text).toBe("No rain-index replay for this case");
  expect(noStepsText(bundle({ series: undefined } as never))).toBe("No frames published yet");
});

test("Uruguaiana swipe stack: one viewing geometry (main track, or no context passes)", async () => {
  const { nisarStack } = await import("./radar");
  const f = (date: string, png: string, extra: Record<string, unknown> = {}) =>
    ({ id: `nisar_hh_${date}`, date, png, kind: "nisar_frame", polarization: "HH", ...extra });
  const mk = (layers: unknown[]) => ({ id: "rs_uruguai_2026", mode: "replay", bbox: [-58, -30, -56, -29], manifest: { event: "rs_uruguai_2026", layers } }) as never;
  const byTrack = nisarStack(mk([
    f("2026-09-30", "png/a.png", { track: "010D" }), f("2026-10-05", "png/b_082D.png", { track: "082D" }),
    f("2026-10-12", "png/c.png", { track: "010D" }), f("2026-10-28", "png/d.png", { track: "060A" }),
  ]))!;
  expect(byTrack.dates).toEqual(["2026-09-30", "2026-10-12"]);
  const noTrack = nisarStack(mk([
    f("2026-09-30", "png/a.png"), f("2026-10-05", "png/b_082D.png"), f("2026-10-12", "png/c.png"),
    f("2026-10-17", "png/e.png", { note: "track 082 D frame 103; context track (082 D)" }),
  ]))!;
  expect(noTrack.dates).toEqual(["2026-09-30", "2026-10-12"]);
});

test("Uruguaiana change maps (kind nisar_change) join the NISAR extras, HH only, plain dates", async () => {
  const { nisarExtras } = await import("./nisarExtras");
  const b = { id: "rs_uruguai_2026", mode: "replay", bbox: [-58, -30, -56, -29], manifest: { event: "rs_uruguai_2026", layers: [
    { id: "nisar_hh_change_20261012", kind: "nisar_change", date: "2026-10-12", png: "rs_uruguai_2026/png/nisar_hh_change_20261012.png", label: "NISAR HH change (Sep 30 → 10-12)", legend: ["Baixo"] },
    { id: "nisar_hv_change_20261012", kind: "nisar_change", date: "2026-10-12", png: "rs_uruguai_2026/png/nisar_hv_change_20261012.png", label: "NISAR HV change (Sep 30 → 10-12)" },
  ] } } as never;
  const x = nisarExtras(b);
  expect(x.map((e) => e.label)).toEqual(["NISAR HH change (Sep 30 → Oct 12)"]);
});
