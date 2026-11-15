// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bundle, zone, zones } from "./fixtures";
import { replayAlerts, replayAlertsAt, replayLaterText, replayPlaces } from "./replayAlerts";

// Real files: lead-analysis forecast replay + the synced case series.
const json = (p: string) => JSON.parse(readFileSync(join(process.cwd(), p), "utf8"));
const WA_LEAD = json("test/fixtures/lead/forecast_lead_time_wa_2025.json");
const RS_LEAD = json("test/fixtures/lead/forecast_lead_time_rs_2024.json");
const WA_SERIES = json("public/data/wa_2025/series/imerg_smap_daily.json");
const RS_SERIES = json("public/data/rs_2024/series/imerg_smap_daily.json");

const wa = bundle({ forecastLeadTime: WA_LEAD, series: WA_SERIES });
const rs = bundle({ id: "rs_2024", reference_date: "2024-05-02", forecastLeadTime: RS_LEAD, series: RS_SERIES });

describe("replay alerts (live rule on replay data)", () => {
  test("WA: first raise is the Dec 5 GFS forecast, still Critical through Dec 8; k=2/3 days do not fire", () => {
    const all = replayAlerts(wa);
    const fc = all.filter((a) => a.source === "forecast");
    expect(fc.length).toBe(1);
    expect(all[0].date).toBe("2025-12-05");
    expect(all[0].source).toBe("forecast");
    expect(all[0].hazard).toBe("flood or landslide");
    expect(all[0].level).toBe("emergency");
    expect(all[0].title).toBe("Replay: CRITICAL flood or landslide risk");
    expect(all[0].through).toBe("2025-12-08");
    expect(all[0].rain).toBe("still Critical through Dec 8, 2025");
    expect(all[0].guidance).toContain("forecast · NOAA GFS (issued Dec 5, 2025)");
    expect(all.some((a) => a.date === "2025-12-03" || a.date === "2025-12-04")).toBe(false);
  });

  test("WA: first observed Critical landslide on Dec 9 with km² and people (estimate)", () => {
    const slide = replayAlerts(wa).filter((a) => a.source === "observed" && a.hazard === "landslide");
    expect(slide.length).toBe(1);
    expect(slide[0].date).toBe("2025-12-09");
    expect(slide[0].through).toBe("2025-12-10");
    expect(slide[0].area_km2).toBe(1044.03);
    expect(slide[0].rain).toBe("292 people in Critical areas (estimate) · still Critical through Dec 10, 2025");
    expect(slide[0].guidance).toContain("observed (IMERG + SMAP as of that day)");
    expect(slide[0].title).toBe("Replay: CRITICAL landslide risk");
  });

  test("RS: Apr 23 forecast raise", () => {
    const fc = replayAlerts(rs).filter((a) => a.source === "forecast");
    expect(fc.map((a) => a.date)).toEqual(["2024-04-23"]);
    expect(fc[0].through).toBe("2024-04-23");
    expect(fc[0].rain).toBeUndefined();
    expect(fc[0].guidance).toContain("issued Apr 23, 2024");
  });

  test("only alerts on or before the step are listed; the rest are counted", () => {
    const total = replayAlerts(wa).length;
    expect(replayAlertsAt(wa, "2025-12-04")).toEqual({ shown: [], later: total });
    const dec5 = replayAlertsAt(wa, "2025-12-05");
    expect(dec5.shown.map((a) => a.date)).toEqual(["2025-12-05"]);
    expect(dec5.later).toBe(total - 1);
    expect(replayAlertsAt(wa, "2025-12-20").later).toBe(0);
    expect(replayLaterText(2)).toBe("2 more later in the replay");
    expect(replayLaterText(0)).toBeUndefined();
  });

  test("fill values in the series never raise an alert", () => {
    const b = bundle({ series: { event: "x", reference_date: "2025-12-10", days: [
      { date: "2025-12-09", offset: -1, kind: "observed", imerg_mm: 1, smap: 0.5, tpi: 0.9, critical_slide_km2: -9999, critical_flood_km2: 0 },
      { date: "2025-12-10", offset: 0, kind: "forecast", imerg_mm: 1, smap: 0.5, tpi: 0.9, critical_slide_km2: 50 },
    ] } });
    expect(replayAlerts(b)).toEqual([]);
  });

  test("places: top 3 priority zones by rank and 'N more', as of the reference date", () => {
    const b = bundle({ zones: zones([zone(4, { name: "D" }), zone(1, { name: "A" }), zone(3, { name: "C" }), zone(2, { name: "B" }), zone(5, { name: "E" })]) });
    expect(replayPlaces(b)).toBe("A, B, C and 2 more (places as of Dec 10, 2025)");
  });

  test("a live bundle gets no replay alerts", () => {
    expect(replayAlerts({ ...wa, mode: "live" })).toEqual([]);
  });
});
