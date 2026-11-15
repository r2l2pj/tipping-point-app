// Lucas: hour chips over lead-analysis 6-hourly frames; swipe dates as chips.
// @ts-expect-error -- bun:test resolves under `bun test`
import { expect, test } from "bun:test";
import { hasHourFrames, hourFrameFor, hourLabel, hoursOn } from "./hours";

const six = (datetime: string) => ({ id: "tpi_flood_6h", date: datetime.slice(0, 10), datetime, png: `png/tpi_flood_6h_${datetime}.png` });
const b = { id: "rs_uruguai_2026", mode: "replay", bbox: [0, 0, 1, 1], manifest: { layers: [
  six("2026-09-30T00:00Z"), six("2026-09-30T06:00Z"), six("2026-09-30T12:00Z"), six("2026-09-30T18:00Z"), six("2026-10-01T00:00Z"),
  { id: "tpi_flood", date: "2026-09-30", png: "png/tpi_flood_20260930.png" },
] } } as never;

test("hour chips only where 6-hourly frames exist; hours of the selected day", () => {
  expect(hasHourFrames(b, "flood")).toBe(true);
  expect(hasHourFrames(b, "slide")).toBe(false);
  expect(hasHourFrames({ id: "wa_2025", mode: "replay", bbox: [0, 0, 1, 1], manifest: { layers: [] } } as never, "flood")).toBe(false);
  expect(hoursOn(b, "flood", "2026-09-30")).toEqual(["00", "06", "12", "18"]);
  expect(hoursOn(b, "flood", "2026-10-01")).toEqual(["00"]);
  expect(hourFrameFor(b, "flood", "2026-09-30", "06")?.png).toBe("png/tpi_flood_6h_2026-09-30T06:00Z.png");
  expect(hourFrameFor(b, "flood", "2026-09-30", null)).toBeUndefined();
  expect(hourLabel(hourFrameFor(b, "flood", "2026-09-30", "06")!)).toBe("Sep 30, 03:00 BRT");
});

test("setCompareDates moves the swipe dates (Radar card chips)", async () => {
  const { reduce, initialState } = await import("../state");
  const s = reduce(initialState([b]), { type: "setCompareDates", before: "2026-09-18", after: "2026-11-05" }, [b]);
  expect(s.compareInit).toMatchObject({ before: "2026-09-18", after: "2026-11-05" });
});
