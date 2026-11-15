// L22 issued-forecast (NOAA GFS) frames on the timeline: a forecast step
// paints the latest run issued on or before the reference date, never a
// later one, and names it "forecast · NOAA GFS (issued <date>)".
// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import StatusBlock from "../StatusBlock";
import TimelineBar from "../TimelineBar";
import { bundle, frame, liveBundle, manifest } from "./fixtures";
import { statusChip } from "./status";
import { forecastTag, frameFor, gfsRain3Label, mapCaption, stepLabel, stepsFor } from "./steps";

// The brief's case: reference 2024-05-02; on 2024-05-03 an observed frame,
// a perfect-forecast upper bound and a GFS run issued 2024-05-02; on
// 2024-05-04 only a GFS run issued 2024-05-03 (after the anchor — never shown).
const gfsLayers = () => [
  frame("tpi_flood", "2024-05-03"),
  { ...frame("tpi_flood_d1", "2024-05-03"), upper_bound: true },
  {
    ...frame("tpi_flood_gfs_d1", "2024-05-03"),
    issued: "2024-05-02",
    forecast_source: "noaa-gfs",
  },
  {
    ...frame("tpi_flood_gfs_d2", "2024-05-04"),
    issued: "2024-05-03",
    forecast_source: "noaa-gfs",
  },
];

const gfsBundle = () =>
  bundle({
    reference_date: "2024-05-02",
    series: {
      event: "wa_2025",
      reference_date: "2024-05-02",
      tpi_threshold: 0.6,
      days: [
        { date: "2024-05-02", offset: 0, kind: "observed" as const, tpi: 0.2, imerg_mm: 10, smap: 0.9 },
        { date: "2024-05-03", offset: 1, kind: "forecast" as const, tpi: 0.9, imerg_mm: 10, smap: 0.9 },
        { date: "2024-05-04", offset: 2, kind: "forecast" as const, tpi: 0.9, imerg_mm: 10, smap: 0.9 },
      ],
    },
    manifest: manifest(gfsLayers(), { forecast_source: "perfect-forecast" }),
  });

describe("L22 issued GFS frames", () => {
  test("a forecast step paints the latest GFS run issued on or before the reference date", () => {
    const b = gfsBundle();
    const steps = stepsFor(b);
    expect(steps.map((s) => s.forecast)).toEqual([false, true, true]);
    const f = frameFor(b, "2024-05-03", "flood");
    expect(f?.layer.id).toBe("tpi_flood_gfs_d1");
    expect(f?.forecast).toBe(true);
    expect(steps[1].layer?.id).toBe("tpi_flood_gfs_d1");
  });

  test("a GFS run issued after the reference date is never shown", () => {
    const b = gfsBundle();
    expect(frameFor(b, "2024-05-04", "flood")).toBeUndefined();
    expect(stepsFor(b)[2].layer).toBeUndefined();
    const cap = mapCaption(b, stepsFor(b), 2, "flood", ["tpi"]);
    expect(cap.text).not.toContain("GFS");
    expect(cap.text).toContain("no map frame");
  });

  test("the caption and the step line name the issued run", () => {
    const b = gfsBundle();
    const steps = stepsFor(b);
    expect(mapCaption(b, steps, 1, "flood", ["tpi"]).text).toContain(
      "forecast · NOAA GFS (issued May 2, 2024)"
    );
    expect(stepLabel(b, steps[1])).toBe(
      "May 3 (D+1) · forecast · NOAA GFS (issued May 2, 2024)"
    );
    // A step whose only GFS run came after the anchor keeps the case source.
    expect(stepLabel(b, steps[2])).toBe("May 4 (D+2) · forecast · perfect forecast");
  });

  test("an observed step never gets forecast wording", () => {
    const b = gfsBundle();
    const steps = stepsFor(b);
    expect(stepLabel(b, steps[0])).toBe("May 2 (EVENT) · observed");
    expect(mapCaption(b, steps, 0, "flood", ["tpi"])).toEqual({
      text: "May 2, 2024 (EVENT) · no map frame",
      forecast: false,
    });
  });

  test("stepsFor never creates a step from a _gfs_ frame date", () => {
    const b = liveBundle({
      manifest: manifest([
        frame("tpi_slide_d0", "2026-11-14"),
        frame("tpi_slide_d1", "2026-11-15"),
        // A GFS frame on an observed date does not flip it to forecast…
        { ...frame("tpi_flood_gfs_d1", "2026-11-14"), issued: "2026-11-13" },
        // …and a GFS-only date creates no step.
        {
          ...frame("tpi_slide_gfs_d1", "2026-11-16"),
          issued: "2026-11-15",
          forecast_source: "noaa-gfs",
        },
      ]),
    });
    const steps = stepsFor(b);
    expect(steps.map((s) => s.date)).toEqual(["2026-11-14", "2026-11-15"]);
    expect(steps.map((s) => s.forecast)).toEqual([false, true]);
  });

  test("the timeline tag and the status chip render the issued run", () => {
    const b = gfsBundle();
    const steps = stepsFor(b);
    const timeline = renderToStaticMarkup(
      <TimelineBar
        steps={steps}
        marks={[]}
        dayIndex={1}
        playing={false}
        forecastTag={forecastTag(b)}
        onSeek={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
        onPlayToggle={() => {}}
      />
    );
    expect(timeline).toContain("forecast · NOAA GFS (issued May 2, 2024)");
    const block = renderToStaticMarkup(
      <StatusBlock
        chip={statusChip(b, steps, 1, "flood")}
        status={{ kind: "archive" }}
        stepLabel={stepLabel(b, steps[1])}
      />
    );
    expect(block).toContain("forecast · NOAA GFS (issued May 2, 2024)");
    // The observed step line carries no forecast wording. (The chip may
    // announce the May 3 forecast — naming that day's frame is correct.)
    const observed = renderToStaticMarkup(
      <StatusBlock
        chip={statusChip(b, steps, 0, "flood")}
        status={{ kind: "archive" }}
        stepLabel={stepLabel(b, steps[0])}
      />
    );
    expect(observed).toContain("Step: May 2 (EVENT) · observed");
  });
});

describe("gfsRain3Label", () => {
  test("names the issue date, or the range of runs", () => {
    expect(gfsRain3Label([{ gfs_rain3_mm: 130.3, gfs_rain3_issued: "2024-05-01" }]))
      .toBe("Forecast rain 3-day (NOAA GFS, issued May 1, 2024)");
    expect(gfsRain3Label([
      { gfs_rain3_mm: 130.3, gfs_rain3_issued: "2024-05-01" },
      { gfs_rain3_mm: 12.9, gfs_rain3_issued: "2024-05-05" },
      { gfs_rain3_mm: null, gfs_rain3_issued: "2024-05-06" },
    ])).toBe("Forecast rain 3-day (NOAA GFS, issued May 1, 2024 – May 5, 2024)");
    expect(gfsRain3Label([{ gfs_rain3_mm: null, gfs_rain3_issued: "2024-05-01" }])).toBeUndefined();
  });
});
