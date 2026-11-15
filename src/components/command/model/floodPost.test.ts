// L52 — the merged replay view (Lucas: "mix Washington: forecast + NISAR").
// A replay that ships both the TPI index and the NISAR flood outlines opens
// with ['tpi','flood'] (deep links still win); the outlines paint only
// on/after the post-pass day; the caption names the pass.
// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";

import { bundle, frame, liveBundle, manifest, series, zone, zones } from "./fixtures";
import { defaultLayersFor } from "./layerRegistry";
import { floodCaptionNote, floodPostDate, floodShownOn } from "./steps";
import { initialState, reduce } from "../state";

// WA 2025 shape: landslide TPI frames, a NISAR post pass, flood outlines.
const wa = bundle({
  manifest: manifest([
    frame("tpi_slide_20251210", "2025-12-10"),
    frame("tpi_slide_20251216", "2025-12-16"),
    frame("imerg_20251211", "2025-12-11"),
    frame("nisar_post", "2025-12-16"),
  ]),
  series: series([0.4, 0.6, 0.9]),
  zones: zones([zone(1)]),
  flood: zones([zone(1)]),
});

// A replay without the flood product (RS shape): TPI only.
const rs = bundle({
  id: "rs_2024",
  title: "RS 2024",
  manifest: manifest([frame("tpi_slide_20240502", "2024-05-02")]),
  series: series([0.8, 0.5]),
  zones: zones([zone(1)]),
});

describe("floodPostDate", () => {
  test("reads the nisar_post layer date", () => {
    expect(floodPostDate(wa)).toBe("2025-12-16");
  });
  test("data_dates wins when no post layer; absent otherwise", () => {
    const onlyDd = bundle({
      manifest: manifest([frame("tpi_slide_20251210", "2025-12-10")]),
      data_dates: { nisar_post: "2025-12-18" },
    });
    expect(floodPostDate(onlyDd)).toBe("2025-12-18");
    expect(floodPostDate(bundle({}))).toBeUndefined();
  });
});

describe("floodShownOn", () => {
  test("replay: hidden before the pass, shown from it on", () => {
    expect(floodShownOn(wa, "2025-12-15")).toBe(false);
    expect(floodShownOn(wa, "2025-12-16")).toBe(true);
    expect(floodShownOn(wa, "2025-12-20")).toBe(true);
  });
  test("no post date, no date, or live → unchanged", () => {
    const noPost = bundle({ manifest: manifest([frame("tpi_slide_20251210", "2025-12-10")]) });
    expect(floodShownOn(noPost, "2025-12-10")).toBe(true);
    expect(floodShownOn(liveBundle({}), "2026-11-14")).toBe(true);
    expect(floodShownOn(wa, undefined)).toBe(true);
  });
});

describe("floodCaptionNote", () => {
  test("names the pass while the outlines are on screen", () => {
    expect(floodCaptionNote(wa, "2025-12-16", ["tpi", "flood"]))
      .toBe(" · NISAR flood outlines (pass Dec 16, 2025)");
  });
  test("silent before the pass, without the layer, or without a post date", () => {
    expect(floodCaptionNote(wa, "2025-12-15", ["tpi", "flood"])).toBe("");
    expect(floodCaptionNote(wa, "2025-12-16", ["tpi"])).toBe("");
    expect(floodCaptionNote(bundle({}), "2025-12-16", ["tpi", "flood"])).toBe("");
  });
});

describe("defaultLayersFor", () => {
  test("replay with TPI + flood opens merged", () => {
    expect(defaultLayersFor(wa, "slide")).toEqual(["tpi", "flood"]);
    expect(defaultLayersFor(wa, "flood")).toEqual(["tpi"]);
  });
  test("replay without the flood layer keeps the TPI default", () => {
    expect(defaultLayersFor(rs, "slide")).toEqual(["tpi"]);
  });
  test("flood product without a pass date is not the NISAR layer", () => {
    const noPass = bundle({ ...wa, manifest: manifest([frame("tpi_slide_20251210", "2025-12-10")]), data_dates: {} });
    expect(defaultLayersFor(noPass, "slide")).toEqual(["tpi"]);
  });
  test("live + landslide keeps the ML layer as the primary view", () => {
    const live = liveBundle({
      manifest: manifest([frame("p_trigger_24h_20261114", "2026-11-14")]),
    });
    expect(defaultLayersFor(live, "slide")).toEqual(["ptrigger"]);
  });
});

describe("state: merged replay defaults", () => {
  test("initial state opens ['tpi','flood']", () => {
    const st = initialState([wa], "wa_2025", undefined);
    expect(st.hazard).toBe("slide");
    expect(st.layers).toEqual(["tpi", "flood"]);
  });
  test("?layers= deep link still wins over the merged default", () => {
    const st = initialState([wa], "wa_2025", undefined, { layers: "imerg" });
    expect(st.layers).toEqual(["imerg"]);
  });
  test("a replay without the flood layer keeps ['tpi']", () => {
    const st = initialState([rs], "rs_2024", undefined);
    expect(st.layers).toEqual(["tpi"]);
  });
  test("selectCase into the merged replay gives ['tpi','flood']", () => {
    const st = initialState([rs, wa], "rs_2024", undefined);
    const next = reduce(st, { type: "selectCase", id: "wa_2025" }, [rs, wa]);
    expect(next.layers).toEqual(["tpi", "flood"]);
  });
  test("goTo into the merged replay gives ['tpi','flood']", () => {
    const st = initialState([rs, wa], "rs_2024", undefined);
    const next = reduce(st, { type: "goTo", id: "wa_2025" }, [rs, wa]);
    expect(next.layers).toEqual(["tpi", "flood"]);
  });
});
