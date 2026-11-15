import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { anchorShort, warnedRow } from "./replayCheck";

// lead-analysis fallback bb125cf values (authored 0-100).
describe("warned before the damage (lead-analysis)", () => {
  test("RS: landslide points, published percent as is, with Critical and observed", () => {
    const r = warnedRow({
      slide_warned_pct: 88.13, slide_warned_critical_pct: 69.07, slide_warned_observed_pct: 88.83,
      slide_warned: { n_points: 16027, anchor_basis: "onset", anchor_utc: "2024-05-01T00:00:00+00:00", by_issue_gfs: [
        { issue: "2024-04-29", hours_before_anchor: 48, alto_or_critico_pct: 0.27 },
        { issue: "2024-04-30", hours_before_anchor: 24, alto_or_critico_pct: 88.13 },
        { issue: "2024-04-28", hours_before_anchor: 72, alto_or_critico_pct: 70.89 },
        { issue: "2024-04-27", hours_before_anchor: 96, alto_or_critico_pct: 0 },
      ] },
      flood_warned_pct: null,
    })!;
    expect(r.name).toBe("Mapped landslides in High or Critical areas (forecast as issued)");
    expect(r.value).toBe("88.1% of 16,027 mapped landslides (Critical 69.1%)");
    // L36: the 24, 48 and 72 h runs side by side, nearest first; single runs vary.
    expect(r.detail).toBe(
      "NOAA GFS forecast issued 24 h before the event start (May 1, 2024): 88.1%; 48 h before: 0.27%; 72 h before: 70.9% — single runs vary; with observed rain instead: 88.8%."
    );
    expect(r.detail).not.toContain("96 h");
  });
  test("WA: 0.14 is 0.14 %, never 14 %; the explanation rides along", () => {
    const r = warnedRow({
      flood_warned_pct: 0.14, flood_warned_critical_pct: 0, flood_warned_observed_pct: 0,
      flood_warned: { anchor_basis: "onset", confirmed_flood_km2: 27.921, explanation: "TPI_flood is pixel-local." },
    })!;
    expect(r.value).toMatch(/^0\.14% of 27\.9 km² radar-mapped flood \(Critical 0\.0%\)$/);
    expect(r.name).toBe("Flooded area in High or Critical areas (forecast as issued)");
    expect(r.detail).toContain("TPI_flood is pixel-local.");
    expect(r.detail).not.toContain("single runs vary");
  });
  test("L37: the anchor date and the hours come from metrics, never a fixed 'May 1'", () => {
    const r = warnedRow({
      slide_warned_pct: 61.2,
      slide_warned: { n_points: 16027, anchor_basis: "onset", anchor_utc: "2024-04-30T00:00:00+00:00", by_issue_gfs: [
        { issue: "2024-04-29", hours_before_anchor: 24, alto_or_critico_pct: 61.2 },
        { issue: "2024-04-28", hours_before_anchor: 48, alto_or_critico_pct: 12.5 },
      ] },
    })!;
    expect(r.detail).toStartWith("NOAA GFS forecast issued 24 h before the event start (Apr 30, 2024): 61.2%; 48 h before: 12.5%");
    expect(r.detail).not.toContain("May 1");
    expect(r.name).not.toMatch(/May|Apr|\d/);
    // no anchor in the data: no date at all
    expect(warnedRow({ slide_warned_pct: 50, slide_warned: { anchor_basis: "onset", by_issue_gfs: [] } })!.detail).toContain("before the event start.");
  });
  test("L37 guard: no anchor_basis 'onset' -> no slide numbers, 're-anchored' note; flood too", () => {
    for (const basis of [undefined, "reported_damage", "ONSET"]) {
      const r = warnedRow({
        slide_warned_pct: 88.13, slide_warned_critical_pct: 69.07, slide_warned_observed_pct: 88.83,
        slide_warned: { n_points: 16027, anchor_basis: basis, anchor_utc: "2024-05-01T00:00:00+00:00", by_issue_gfs: [
          { issue: "2024-04-30", hours_before_anchor: 24, alto_or_critico_pct: 88.13 },
        ] },
      })!;
      expect(r.name).toBe("Mapped landslides in High or Critical areas (forecast as issued)");
      expect(r.value).toBe("being re-anchored to the event start");
      expect(r.missing).toBe(true);
      expect(r.detail).toBeUndefined();
      expect(JSON.stringify(r)).not.toMatch(/88|May 1/);
    }
    // flood row: same guard (conductor)
    const wa = warnedRow({ flood_warned_pct: 0.14, flood_warned: { confirmed_flood_km2: 27.921 } })!;
    expect(wa.name).toBe("Flooded area in High or Critical areas (forecast as issued)");
    expect(wa.value).toBe("being re-anchored to the event start");
    expect(JSON.stringify(wa)).not.toContain("0.14");
    expect(warnedRow({ flood_warned_pct: 0.14, flood_warned: { anchor_basis: "onset", confirmed_flood_km2: 27.921 } })!.value)
      .toContain("0.14%");
  });
  test("L37 real export (fallback e7a3e27): by_lead runs, anchor from the anchor fields", () => {
    const real = JSON.parse(readFileSync(join(import.meta.dir, "../../../../test/fixtures/metrics-l37.json"), "utf8")).cases;
    const rs = warnedRow(real.rs_2024)!;
    expect(rs.value).toBe("36.5% of 16,027 mapped landslides (Critical 1.9%)");
    expect(rs.detail).toBe(
      "NOAA GFS forecast issued 27 h before the first deaths (Apr 29, 2024): 36.5%; 51 h before: 0.0%; 75 h before: 0.0% — single runs vary; with observed rain instead: 0.25%."
    );
    const wa = warnedRow(real.wa_2025)!;
    expect(wa.value).toBe("0.0% of 27.9 km² radar-mapped flood (Critical 0.0%)");
    expect(wa.detail).toStartWith(
      "NOAA GFS forecast issued 32 h before heavy rain began (Dec 8, 2025): 0.0%; 56 h before: 0.0%; 80 h before: 0.14% — single runs vary; with observed rain instead: 0.0%."
    );
    expect(rs.detail + wa.detail).not.toMatch(/May 1|88/);
  });
  test("anchorShort: anchor_short wins; label head; fallback", () => {
    expect(anchorShort({ anchor_short: "the first deaths" })).toBe("the first deaths");
    expect(anchorShort({ anchor_label: "event onset: first deaths of the event (2 flood deaths, Paverama, 2024-04-29); heavy rain" })).toBe("the first deaths");
    expect(anchorShort({ anchor_label: "event onset day: heavy rain begins 2025-12-08; Skagit County EOC" })).toBe("heavy rain began");
    expect(anchorShort({})).toBe("the event start");
  });
  test("no published value: no row", () => {
    expect(warnedRow({ flood_warned_pct: null })).toBeUndefined();
  });
});
