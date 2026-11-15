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
