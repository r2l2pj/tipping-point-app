// @ts-expect-error -- bun:test resolves under `bun test`
import { expect, test } from "bun:test";
import { shortCaption } from "./caption";

test("one-line map chip from the full caption", () => {
  expect(shortCaption("Landslide TPI · Today · observed to Nov 14 + NOAA GFS forecast for Nov 15 (partly forecast) · NISAR flood outlines (pass Nov 6, 2026)", true))
    .toBe("Landslide TPI · Today · partly forecast");
  expect(shortCaption("Flood TPI · Sep 30, 2026 · NISAR flood outlines (pass Oct 12, 2026)", false)).toBe("Flood TPI · Sep 30, 2026");
  expect(shortCaption("Rain (NASA GPM IMERG Early, observed 3-day) · Sep 28–30, 2026", false)).toBe("Rain · Sep 28–30, 2026");
  expect(shortCaption("Flood TPI · Dec 17, 2025 (D+7) · forecast (perfect forecast)", true)).toBe("Flood TPI · Dec 17, 2025 · forecast");
  expect(shortCaption("No rain-index replay for this case", false)).toBe("No rain-index replay for this case");
});
