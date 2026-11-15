import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { anchorShort, catalogHitsDetail, emsRow, handCheck, ONSET_LEAD_NAME, ONSET_LEAD_SCOPE, onsetLead, warnedRow } from "./replayCheck";

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

describe("L37 onset lead time (forecast_lead_time_onset)", () => {
  const real = JSON.parse(readFileSync(join(import.meta.dir, "../../../../test/fixtures/metrics-l37.json"), "utf8")).cases;
  test("labelled 'Critical anywhere in the region', never 'at the damage'", () => {
    const rs = onsetLead(real.rs_2024)!;
    expect(rs.text).toBe("2 of 7 forecast runs reached it, 147 h and 27 h ahead");
    expect(rs.lines).toEqual(["Event start: the first deaths (Apr 29, 2024)", "Earliest forecast run that reached it: Apr 23, 2024 (00Z)"]);
    const wa = onsetLead(real.wa_2025)!;
    expect(wa.text).toBe("median 80 h (IQR 56–104 h, 5 of 8 forecast runs)");
    expect(ONSET_LEAD_NAME).toContain("Critical anywhere in the region");
    expect(ONSET_LEAD_SCOPE).toContain("not at the damage sites");
  });
  test("held unless onset-anchored AND defined as 'anywhere' in the region", () => {
    const o = real.wa_2025.forecast_lead_time_onset;
    expect(onsetLead({ forecast_lead_time_onset: { ...o, anchor_basis: "king_county_update" } })).toBeUndefined();
    expect(onsetLead({ forecast_lead_time_onset: { ...o, definition: "TPI Critical at the damage points" } })).toBeUndefined();
    expect(onsetLead({})).toBeUndefined();
    expect(onsetLead({ forecast_lead_time_onset: { ...o, n_warned: 0, issue_days: [] } })!.text)
      .toBe("none of 8 forecast runs reached Critical before the event start");
  });
});

describe("QA fresh eyes: catalog hits say 'observed, after the fact'", () => {
  test("RS 16,027 points; WA 15 points flagged fragile", () => {
    expect(catalogHitsDetail({ landslide_hit: { n_points: 16027 } }))
      .toBe("Share of the 16,027 mapped landslides where the index was Critical (0.60 or more) with observed rain at the event peak — measured after the fact, not a forecast.");
    expect(catalogHitsDetail({ landslide_hit: { n_points: 15 } })).toContain("Only 15 points: a fragile share.");
    expect(catalogHitsDetail({})).toContain("Share of the mapped landslides");
  });
});

describe("HAND check + WA denominator (lead-analysis fallback 80505ff)", () => {
  test("IoU 0-1 with r and radius; out of range or absent -> no card", () => {
    expect(handCheck({ hand_validation: 0.26, hand_validation_iou: 0.2613, hand_validation_r: 0.8719, hand_validation_radius_m: 1000, hand_validation_definition: "IoU of HAND<5 m zones" }))
      .toEqual({ line: "IoU 0.26 · r 0.87 · radius 1000 m", definition: "IoU of HAND<5 m zones" });
    expect(handCheck({ hand_validation_iou: 26 })).toBeUndefined();
    expect(handCheck({ hand_validation: 0.98 })).toBeUndefined();
  });
  test("WA warned row carries the denominator label", () => {
    const r = warnedRow({ flood_warned_pct: 0, flood_warned_denominator_label: "27.9 km² of NISAR flood pixels on the ~12 m flood raster (the denominator); the canonical flooded_km2 27.99 km² is the polygon set within the swath",
      flood_warned: { anchor_basis: "onset", confirmed_flood_km2: 27.921 } })!;
    expect(r.detail).toContain("27.9 km² of NISAR flood pixels on the ~12 m flood raster (the denominator); the canonical flooded_km2 27.99 km² is the polygon set within the swath.");
  });
});

describe("HAND card on the served radius (conductor)", () => {
  const byRadius = {
    "1000": { iou: 0.2613, r: 0.8720 },
    "1500": { iou: 0.1914, r: 0.8544 },
    "3000": { iou: 0.1079, r: 0.7886 },
  };
  test("served 1500 m: its numbers, best 1000 m as a note", () => {
    const h = handCheck({ hand_served_radius_m: 1500, hand_best_radius_m: 1000, hand_validation_by_radius: byRadius,
      hand_validation_iou: 0.2613, hand_validation_r: 0.872, hand_validation_radius_m: 1000 })!;
    expect(h.line).toBe("IoU 0.19 · r 0.85 · radius 1500 m (the radius the index uses)");
    expect(h.note).toBe("Best radius 1000 m (IoU 0.26, r 0.87).");
  });
  test("no served key yet: the configured 1500 m from by_radius (lead-analysis), best as note", () => {
    const h = handCheck({ hand_best_radius_m: 1000, hand_validation_by_radius: byRadius, hand_validation_iou: 0.2613, hand_validation_r: 0.872, hand_validation_radius_m: 1000 })!;
    expect(h.line).toBe("IoU 0.19 · r 0.85 · radius 1500 m (the radius the index uses)");
    expect(h.note).toBe("Best radius 1000 m (IoU 0.26, r 0.87).");
  });
  test("served_* keys win; no by_radius at all -> published headline radius", () => {
    const h = handCheck({ hand_validation_served_radius_m: 1500, hand_validation_served_iou: 0.344, hand_validation_served_r: 0.859,
      hand_best_radius_m: 1000, hand_validation_by_radius: { "1000": { iou: 0.42, r: 0.9 } } })!;
    expect(h.line).toBe("IoU 0.34 · r 0.86 · radius 1500 m (the radius the index uses)");
    expect(h.note).toBe("Best radius 1000 m (IoU 0.42, r 0.90).");
    expect(handCheck({ hand_validation_iou: 0.26, hand_validation_r: 0.87, hand_validation_radius_m: 1000 })!.line).toBe("IoU 0.26 · r 0.87 · radius 1000 m");
  });
});

describe("RS flood vs Copernicus EMS (lead-analysis a363629)", () => {
  test("row from the real keys: scores, Taquari scope, before-onset shares, attribution", () => {
    const m = JSON.parse(readFileSync(join(import.meta.dir, "../../../../test/fixtures/rs-ems.json"), "utf8"));
    const r = emsRow(m)!;
    expect(r.name).toBe("Flood map vs Copernicus EMS (Taquari valley only)");
    expect(r.value).toBe("IoU 0.18 · F1 0.31 · P 0.46 · R 0.24");
    expect(r.detail).toBe("Flood index High or above (observed rain) vs the EMS EMSR720 flood map of May 6, 2024. EMS mapped only five Taquari-valley areas; the Porto Alegre / Guaíba flood is not in it. Before the onset (Apr 29, 2024): 0.21% of the EMS flood area was High or above with observed rain, 6.6% in the NOAA GFS forecast issued Apr 28, 2024 (Critical 0.10%). © European Union, Copernicus Emergency Management Service.");
    expect(emsRow({})).toBeUndefined();
  });
});
