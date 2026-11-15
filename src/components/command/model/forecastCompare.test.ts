// L52 U2 — the forecast-vs-observed swipe: the pair builder (both frames
// present → labels/urls; a missing GFS frame → a reason) and the reducer /
// deep link for `?compare=forecast&lead=<k>&day=<D>`.
// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";

import { bundle, frame, manifest, zone, zones } from "./fixtures";
import {
  forecastCompare,
  forecastFrameFor,
  hasGfsFrames,
  swipeLeadsFor,
} from "./forecastCompare";
import { initialState, reduce } from "../state";
import type { CcBundle } from "./types";

// An rs_2024-style replay: observed tpi_flood frames every day and GFS
// runs issued May 1 (d2, d3) and May 2 (d1, d2, d3).
const gfs = (k: 1 | 2 | 3, date: string, issued: string) => ({
  ...frame(`tpi_flood_gfs_d${k}`, date),
  issued,
  png: `rs_2024/png/tpi_flood_gfs_d${k}_${date.replaceAll("-", "")}.png`,
});
const obs = (date: string) => ({
  ...frame("tpi_flood", date),
  png: `rs_2024/png/tpi_flood_${date.replaceAll("-", "")}.png`,
});

const DAYS = ["2024-05-01", "2024-05-02", "2024-05-03", "2024-05-04", "2024-05-05"];
const rs = (): CcBundle =>
  bundle({
    id: "rs_2024",
    title: "RS 2024",
    reference_date: "2024-05-02",
    manifest: manifest(
      [
        ...DAYS.map(obs),
        gfs(2, "2024-05-03", "2024-05-01"),
        gfs(3, "2024-05-04", "2024-05-01"),
        gfs(1, "2024-05-03", "2024-05-02"),
        gfs(2, "2024-05-04", "2024-05-02"),
        gfs(3, "2024-05-05", "2024-05-02"),
        // A forecast frame for a day without an observed frame.
        gfs(1, "2024-04-30", "2024-04-29"),
        // A run issued after the reference day — never shown (no peeking).
        gfs(2, "2024-05-06", "2024-05-04"),
      ],
      { event: "rs_2024" }
    ),
    series: {
      event: "rs_2024",
      reference_date: "2024-05-02",
      tpi_threshold: 0.6,
      days: DAYS.map((date, i) => ({
        date,
        offset: i - 1,
        kind: (i <= 1 ? "observed" : "forecast") as "observed" | "forecast",
        tpi: 0.5,
        imerg_mm: 10,
        smap: 0.9,
      })),
    },
    zones: zones([zone(1, { hazard: "flood" })]),
  });

describe("forecastCompare pair builder", () => {
  test("both frames present → kind, lead, labels and urls", () => {
    const opt = forecastCompare(rs(), "2024-05-03", "flood", 1);
    const p = opt.pair;
    expect(opt.reason).toBeUndefined();
    expect(p?.kind).toBe("forecast");
    expect(p?.lead).toBe(1);
    expect(p?.before.label).toBe("Forecast for May 3, issued May 2 (NOAA GFS)");
    expect(p?.after.label).toBe("Observed May 3 (NASA IMERG + SMAP)");
    expect(p?.before.url).toBe("/data/rs_2024/png/tpi_flood_gfs_d1_20240503.png");
    expect(p?.after.url).toBe("/data/rs_2024/png/tpi_flood_20240503.png");
    expect(p?.bounds).toEqual([-122.6, 47, -121.5, 48.5]);
  });

  test("lead 2 reads the run issued two days before", () => {
    const p = forecastCompare(rs(), "2024-05-03", "flood", 2).pair;
    expect(p?.lead).toBe(2);
    expect(p?.before.label).toBe("Forecast for May 3, issued May 1 (NOAA GFS)");
    expect(p?.before.url).toContain("tpi_flood_gfs_d2_20240503.png");
  });

  test("lead 0 picks the first lead with a pair", () => {
    expect(forecastCompare(rs(), "2024-05-03", "flood", 0).pair?.lead).toBe(1);
    // The first lead for May 5 is 3 (issued May 2).
    expect(forecastCompare(rs(), "2024-05-05", "flood", 0).pair?.lead).toBe(3);
  });

  test("a requested lead the day does not have falls back to one it does", () => {
    // May 5 has only lead 3 (issued May 2): asking for lead 1 keeps the
    // swipe open on the pair that exists.
    const opt = forecastCompare(rs(), "2024-05-05", "flood", 1);
    expect(opt.pair?.lead).toBe(3);
    expect(opt.pair?.before.label).toBe("Forecast for May 5, issued May 2 (NOAA GFS)");
  });

  test("a missing GFS frame gives a reason, not a pair", () => {
    // A day with no runs at all.
    expect(forecastCompare(rs(), "2024-05-01", "flood", 0).reason).toBe(
      "No NOAA GFS forecast for May 1, 2024"
    );
    // …and with an explicit lead it names the missing run's issue day.
    expect(forecastCompare(rs(), "2024-05-01", "flood", 2).reason).toBe(
      "No NOAA GFS forecast issued Apr 29, 2024 for May 1, 2024"
    );
    // A forecast frame without an observed frame of the day.
    expect(forecastCompare(rs(), "2024-04-30", "flood", 1).reason).toBe(
      "No observed TPI frame for Apr 30, 2024"
    );
    expect(forecastCompare(rs(), undefined, "flood", 1).reason).toBeTruthy();
  });

  test("a run issued after the reference day is never used (no peeking)", () => {
    // The May 4 run exists but is after the 2024-05-02 anchor.
    expect(forecastFrameFor(rs(), "2024-05-06", "flood", 2)).toBeUndefined();
    expect(swipeLeadsFor(rs(), "2024-05-06", "flood")).toEqual([]);
    // …while the run issued on the anchor day is found.
    expect(forecastFrameFor(rs(), "2024-05-04", "flood", 2)?.layer.id).toBe("tpi_flood_gfs_d2");
  });

  test("swipeLeadsFor lists only leads with a full pair", () => {
    const b = rs();
    expect(swipeLeadsFor(b, "2024-05-03", "flood")).toEqual([1, 2]);
    expect(swipeLeadsFor(b, "2024-05-04", "flood")).toEqual([2, 3]);
    expect(swipeLeadsFor(b, "2024-05-05", "flood")).toEqual([3]);
    expect(swipeLeadsFor(b, "2024-05-01", "flood")).toEqual([]);
    expect(swipeLeadsFor(b, "2024-05-03", "slide")).toEqual([]);
  });

  test("hasGfsFrames", () => {
    expect(hasGfsFrames(rs())).toBe(true);
    expect(hasGfsFrames(bundle())).toBe(false);
  });
});

describe("forecast compare state", () => {
  const cases = [rs()];

  test("?compare=forecast&lead=2&day=2024-05-03 opens the swipe on that day", () => {
    const s = initialState(cases, "rs_2024", "2024-05-03", { compare: "forecast", lead: "2" });
    expect(s.compareOpen).toBe("forecast");
    expect(s.issueLead).toBe(2);
    expect(s.hazard).toBe("flood");
    expect(s.dayIndex).toBe(2);
    // The pair the screen builds for it.
    const step = s.dayIndex >= 0 ? DAYS[s.dayIndex] : undefined;
    expect(forecastCompare(rs(), step, s.hazard, s.issueLead).pair?.before.label).toContain(
      "issued May 1 (NOAA GFS)"
    );
  });

  test("?compare=forecast without a lead still finds a pair", () => {
    const s = initialState(cases, "rs_2024", "2024-05-03", { compare: "forecast" });
    expect(s.compareOpen).toBe("forecast");
    expect(s.issueLead).toBe(0);
    expect(forecastCompare(rs(), DAYS[s.dayIndex], s.hazard, s.issueLead).pair?.lead).toBe(1);
  });

  test("compare=radar is untouched; forecast opens and closes like it", () => {
    const r = initialState(cases, "rs_2024", undefined, { compare: "radar" });
    expect(r.compareOpen).toBe("radar");
    const s = reduce(initialState(cases), { type: "openCompare", kind: "forecast" }, cases);
    expect(s.compareOpen).toBe("forecast");
    expect(s.playing).toBe(false);
    // A lead chip inside the swipe sets issueLead like the map chips do.
    const led = reduce(s, { type: "setIssueLead", lead: 3 }, cases);
    expect(led.issueLead).toBe(3);
    expect(led.compareOpen).toBe("forecast");
    expect(reduce(led, { type: "escape" }, cases).compareOpen).toBeNull();
  });

  test("seeking while the swipe is open keeps it open (both sides follow)", () => {
    const s = reduce(initialState(cases), { type: "openCompare", kind: "forecast" }, cases);
    const moved = reduce(s, { type: "seek", index: 3 }, cases);
    expect(moved.compareOpen).toBe("forecast");
    expect(moved.dayIndex).toBe(3);
  });
});

describe("forecast view (Lucas): target day, nearest lead, ?view=", () => {
  test("a missing lead falls back to the nearest archived one (never a dead chip)", async () => {
    const { effectiveLead, forecastLeadsForDay } = await import("./steps");
    expect(forecastLeadsForDay(rs(), "2024-05-05", "flood")).toEqual([3]);
    expect(effectiveLead(rs(), "2024-05-05", "flood", 1)).toBe(3);
    expect(effectiveLead(rs(), "2024-05-03", "flood", 2)).toBe(2);
    expect(effectiveLead(rs(), "2024-05-03", "flood", 0)).toBe(0);
  });
  test("?view=forecast opens Forecast at 3 days before; observed = no lead; compare = swipe; never compare by default", () => {
    const cases = [rs()];
    expect(initialState(cases, "rs_2024", "2024-05-03", { view: "forecast" })).toMatchObject({ issueLead: 3, compareOpen: null });
    expect(initialState(cases, "rs_2024", "2024-05-03", { view: "observed", lead: "2" })).toMatchObject({ issueLead: 0, compareOpen: null });
    expect(initialState(cases, "rs_2024", "2024-05-03", { view: "compare", lead: "1" })).toMatchObject({ issueLead: 1, compareOpen: "forecast" });
    expect(initialState(cases, "rs_2024", "2024-05-03")).toMatchObject({ issueLead: 0, compareOpen: null });
  });
});
