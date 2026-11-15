import { describe, expect, test } from "bun:test";
import { warnedRow } from "./replayCheck";

// lead-analysis fallback bb125cf values (authored 0-100).
describe("warned before the damage (lead-analysis)", () => {
  test("RS: landslide points, published percent as is, with Critical and observed", () => {
    const r = warnedRow({
      slide_warned_pct: 88.13, slide_warned_critical_pct: 69.07, slide_warned_observed_pct: 88.83,
      slide_warned: { n_points: 16027, anchor_utc: "2024-05-01T00:00:00+00:00" },
      flood_warned_pct: null,
    })!;
    expect(r.name).toBe("Landslides flagged before the damage");
    expect(r.value).toBe("88.1% of 16,027 inventoried landslides (Critical 69.1%)");
    expect(r.detail).toContain("issued 24–48 h before the damage (May 1, 2024)");
    expect(r.detail).toContain("with observed rain instead: 88.8%");
  });
  test("WA: 0.14 is 0.14 %, never 14 %; the explanation rides along", () => {
    const r = warnedRow({
      flood_warned_pct: 0.14, flood_warned_critical_pct: 0, flood_warned_observed_pct: 0,
      flood_warned: { confirmed_flood_km2: 27.921, explanation: "TPI_flood is pixel-local." },
    })!;
    expect(r.value).toMatch(/^0\.14% of 27\.9 km² radar-confirmed flood \(Critical 0\.0%\)$/);
    expect(r.detail).toContain("TPI_flood is pixel-local.");
  });
  test("no published value: no row", () => {
    expect(warnedRow({ flood_warned_pct: null })).toBeUndefined();
  });
});
