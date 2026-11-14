// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { cutsFor, tpiClass } from "@/lib/tpi";
import { bundle, frame, liveBundle, manifest, series } from "./fixtures";
import { reaches, statusChip, thresholdFor } from "./status";
import {
  caseHasHazard, defaultStepIndex, forecastTag, frameFor, stepMarks, stepsFor,
} from "./steps";

const chip = (b: ReturnType<typeof bundle>, i = 0, hazard: "slide" | "flood" = "slide") =>
  statusChip(b, stepsFor(b), i, hazard);

describe("status chip (replay)", () => {
  const replay = bundle({ series: series([0.7, 0.75, 0.4], [], 0.75) });

  test("reached follows the selected day, including equality and rewinding", () => {
    for (const index of [0, 2, 0]) expect(chip(replay, index).kind).toBe("below");
    expect(chip(replay, 1).label).toBe("Tipping point reached");
    expect(chip(replay, 9).kind).not.toBe("reached");
  });

  test("class cuts supply the threshold when the series has none", () => {
    const b = { ...replay, classCuts: [0.1, 0.3, 0.8], series: { ...replay.series!, tpi_threshold: undefined } };
    expect(thresholdFor(b)).toBe(0.8);
    expect(chip(b, 1).kind).toBe("below");
    expect(chip(b, 1).sentence).toContain("threshold 0.80");
  });

  test("cuts are validated and resolve bundle before manifest before defaults", () => {
    expect(cutsFor()).toEqual([0.2, 0.4, 0.6]);
    const b = { classCuts: [0.1, 0.3, 0.8], manifest: { tpi_cuts: [0.2, 0.5, 0.9] } };
    expect(cutsFor(b)).toEqual([0.1, 0.3, 0.8]);
    expect(cutsFor({ ...b, tpiCuts: [0.15, 0.45, 0.85] })).toEqual([0.15, 0.45, 0.85]);
    expect(cutsFor({ manifest: b.manifest })).toEqual([0.2, 0.5, 0.9]);
    expect(cutsFor({ classCuts: [0.4, 0.2, 0.6] })).toEqual([0.2, 0.4, 0.6]);
  });

  test("no series reads 'No data for this event'", () => {
    expect(chip(bundle()).label).toBe("No data for this event");
  });

  test("a forecast or hindcast day at the threshold is a forecast, with its source", () => {
    const b = bundle({
      series: series([0.2, 0.9, 0.9], ["observed", "forecast", "hindcast"]),
      manifest: manifest([], { forecast_source: "perfect-forecast" }),
    });
    expect(chip(b, 1)).toMatchObject({ label: "Tipping point forecast", source: "perfect forecast" });
    expect(chip(b, 2).kind).toBe("forecast");
    expect(chip(b, 0).label).toBe("Tipping point forecast for Dec 11, 2025");
  });

  test("a later observed day does not make a forecast", () => {
    expect(chip(bundle({ series: series([0.2, 0.9]) }), 0).label).toBe("Below the tipping point");
  });

  test("exactly 0.60 reaches the threshold and is Critical (Q5 default)", () => {
    expect(reaches(0.6, 0.6)).toBe(true);
    expect(tpiClass(0.6).label).toBe("Critical");
    expect(chip(bundle({ series: series([0.6]) })).kind).toBe("reached");
  });
});

describe("status chip (now)", () => {
  test("a Now bundle with no series and no summary never reads 'Below the tipping point'", () => {
    const c = chip(liveBundle());
    expect(c.label).toBe("No live data yet");
    expect(`${c.label} ${c.sentence}`).not.toContain("Below the tipping point");
  });

  test("a summary without a critical area value is still no data", () => {
    expect(chip(liveBundle({ summary: {} })).label).toBe("No live data yet");
  });

  test("reached when the summary reports Critical area for the hazard", () => {
    const b = liveBundle({ summary: { critical_km2: { slide: 12.5, flood: 0, any: 12.5 } } });
    expect(chip(b, 0, "slide").label).toBe("Tipping point reached");
    expect(chip(b, 0, "flood").label).toBe("Below the tipping point");
  });
});

describe("steps", () => {
  test("a case with a series: one step per day, hindcast drawn as forecast", () => {
    const b = bundle({ series: series([0.1, 0.2, 0.3, 0.4], ["observed", "observed", "forecast", "hindcast"], 0.6, 1) });
    const steps = stepsFor(b);
    expect(steps.map((s) => s.sub)).toEqual(["D-1", "EVENT", "D+1", "D+2"]);
    expect(steps.map((s) => s.forecast)).toEqual([false, false, true, true]);
    expect(steps[0].top).toBe("Dec 10");
    expect(defaultStepIndex(steps)).toBe(1);
  });

  test("a case without a series: steps are the distinct frame dates", () => {
    const b = liveBundle({
      manifest: manifest([
        frame("tpi_slide_d0", "2026-11-14"), frame("tpi_flood_d0", "2026-11-14"),
        frame("tpi_slide_d1", "2026-11-15"), frame("tpi_slide_d2", "2026-11-16", true),
        frame("imerg_x", "2026-11-13"),
      ]),
    });
    const steps = stepsFor(b);
    expect(steps.map((s) => s.date)).toEqual(["2026-11-14", "2026-11-15", "2026-11-16"]);
    expect(steps.map((s) => s.forecast)).toEqual([false, true, true]);
    expect(steps.every((s) => s.day === undefined)).toBe(true);
    expect(defaultStepIndex(steps)).toBe(0);
  });

  test("a case with neither has no steps", () => {
    expect(stepsFor(liveBundle())).toEqual([]);
    expect(stepsFor(undefined)).toEqual([]);
  });

  test("marks: first Critical and first damage on the matching step", () => {
    const b = bundle({
      series: series([0.1, 0.8, 0.9]),
      metricsView: { damage_anchor: { at: "2025-12-12T08:00:00Z" } },
    });
    expect(stepMarks(b, stepsFor(b))).toEqual([
      { index: 1, label: "first Critical", color: "amber" },
      { index: 2, label: "first damage", color: "red" },
    ]);
  });

  test("the forecast tag names the source of the data, never a fixed one", () => {
    expect(forecastTag(bundle({ manifest: manifest([], { forecast_source: "perfect-forecast" }) })))
      .toBe("Forecast (perfect forecast)");
    expect(forecastTag(liveBundle({ summary: { forecast_source: "geos-fp" } }))).toBe("Forecast (GEOS-FP)");
    expect(forecastTag(bundle())).toBe("Forecast");
  });

  test("frameFor mirrors the hook pick and reports the hazard that is drawn", () => {
    const b = bundle({ manifest: manifest([
      frame("tpi_slide", "2025-12-10"), frame("tpi_flood", "2025-12-10"),
      frame("tpi_flood_d1", "2025-12-11"),
    ]) });
    expect(frameFor(b, "2025-12-10", "flood")?.layer.id).toBe("tpi_flood");
    expect(frameFor(b, "2025-12-11", "slide")).toMatchObject({ hazard: "flood", forecast: true });
    expect(frameFor(b, "2025-12-12", "slide")).toBeUndefined();
    expect(caseHasHazard(b, "slide")).toBe(true);
    expect(caseHasHazard(bundle(), "slide")).toBe(false);
  });
});
