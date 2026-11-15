// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { alertsByRegion, alertsPaused, buildAlertList, capAlertList, moreAlertsText, observedRows, pausedAlertList } from "./alerts";
import { bundle, liveBundle } from "./fixtures";
import { ageText, classLabel, fmtBrt, fmtDate, fmtHours, sourceTime } from "./format";
import { sourceRows } from "./sources";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { placesBySource, toResponseSources } from "../../../lib/response";
import { chartForecastLabel, issuedForecastLabel } from "./steps";

describe("alert list", () => {
  const now = (candidates?: unknown[]) => liveBundle({
    updated_at: "2026-11-14T15:00:00Z",
    nowAlerts: candidates ? { candidates: candidates as never } : undefined,
  });

  test("a load failure or an unpublished source is 'unavailable', never 'none'", () => {
    expect(buildAlertList({ now: null, legacy: null }).state).toBe("unavailable");
    expect(buildAlertList({}).state).toBe("unavailable");
    expect(buildAlertList({ now: now(), legacy: undefined })).toEqual({
      state: "unavailable", alerts: [], dataTime: "2026-11-14T15:00:00Z",
    });
  });

  test("a loaded source with no entries is 'none'", () => {
    expect(buildAlertList({ now: now([]) }).state).toBe("none");
    expect(buildAlertList({ now: now([{ class: 1, label: "low" }]) }).state).toBe("none");
    expect(buildAlertList({ now: null, legacy: { schema: "alerts@1", alerts: [] } }).state).toBe("none");
  });

  test("candidates become alerts, highest level first", () => {
    const list = buildAlertList({ now: now([
      { class: 2, label: "landslide", pixels: 12 },
      { class: 3, label: "flood", pixels: 80, hold: true },
    ]) });
    expect(list.state).toBe("alerts");
    expect(list.alerts.map((a) => a.level)).toEqual(["emergency", "warning"]);
    expect(list.alerts[0]).toMatchObject({ held: true, certainty: "high", valid_from: "2026-11-14T15:00:00.000Z" });
    expect(list.alerts[0].guidance).toContain("SMS 40199");
    expect(alertsByRegion(list.alerts)).toEqual([{ region: "monitored region", level: "emergency", count: 2 }]);
  });
});

describe("format", () => {
  test("canonical dates preserve calendar dates and render timestamps in BRT", () => {
    expect(fmtDate("2026-11-11")).toBe("Nov 11, 2026");
    expect(fmtDate("2026-11-11T01:00:00Z")).toBe("Nov 10, 2026");
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("invalid")).toBe("invalid");
  });

  test("a date-only value renders the same day, not shifted back", () => {
    expect(fmtBrt("2026-11-11")).toContain("Nov 11");
    expect(fmtBrt("2026-11-11")).not.toContain("Nov 10");
    expect(fmtBrt("2026-11-11T15:00:00Z")).toContain("BRT");
  });

  test("hours are whole", () => {
    expect(fmtHours(47.5)).toBe("48 h");
    expect(fmtHours(undefined)).toBe("not published yet");
  });

  test("age text", () => {
    const now = Date.parse("2026-11-14T12:00:00Z");
    expect(ageText("2026-11-14T11:30:00Z", now)).toBe("30 min ago");
    expect(ageText("2026-11-14T07:00:00Z", now)).toBe("5 h ago");
    expect(ageText("2026-11-12", now)).toBe("2 days ago");
    expect(ageText(undefined, now)).toBeUndefined();
  });
});

describe("live run text", () => {
  test("source times are read from the three published shapes", () => {
    expect(sourceTime("2026-11-14T12:00:00Z")).toBe("2026-11-14T12:00:00Z");
    expect(sourceTime("2026-11-14T00Z")).toBe("2026-11-14T00:00:00Z");
    expect(sourceTime("SMAP_L4_SM_gph_20261110T223000_Vv8013_001.h5_u9loH5HD")).toBe("2026-11-10T22:30:00Z");
    expect(sourceTime("2024-05-07")).toBe("2024-05-07");
    expect(sourceTime("some text")).toBeUndefined();
  });

  test("IMERG and SMAP rows show a date, not the raw value", () => {
    const live = liveBundle({
      data_dates: {
        imerg: "2026-11-14T00Z",
        smap: "SMAP_L4_SM_gph_20261110T223000_Vv8013_001.h5_u9loH5HD",
        gfs_issued: "2026-11-14T12:00:00Z",
      },
    });
    const rows = sourceRows(live, new Date("2026-11-14T23:00:00Z").getTime());
    expect(rows[0]).toMatchObject({ date: "Nov 13, 09:00 PM BRT", age: "23 h ago", missing: false });
    expect(rows[1]).toMatchObject({ date: "Nov 10, 07:30 PM BRT", age: "4 days ago", missing: false });
    expect(rows[2]).toMatchObject({ date: "Nov 14, 09:00 AM BRT" });
  });

  test("a value in an unknown shape is shown as published", () => {
    const rows = sourceRows(liveBundle({ data_dates: { imerg: "run 12" } }), Date.now());
    expect(rows[0]).toMatchObject({ date: "run 12", missing: false });
    expect(rows[0].age).toBeUndefined();
  });

  test("class names of the live run are shown in English", () => {
    expect(["Baixo", "Moderado", "Alto", "Crítico", "Critico"].map(classLabel))
      .toEqual(["Low", "Moderate", "High", "Critical", "Critical"]);
    expect(classLabel("Critical")).toBe("Critical");
    expect(classLabel("Extreme")).toBe("Extreme");
  });
});

describe("source rows", () => {
  test("absolute date first; age only for the live case and only with a clock", () => {
    const live = liveBundle({ data_dates: { imerg: "2026-11-14T09:00:00Z" } });
    const now = Date.parse("2026-11-14T12:00:00Z");
    expect(sourceRows(live, now)[0]).toMatchObject({ date: "Nov 14, 06:00 AM BRT", age: "3 h ago", missing: false });
    expect(sourceRows(live)[0].age).toBeUndefined();
    expect(sourceRows(live, now)[1]).toMatchObject({ date: "not published yet", missing: true });
  });

  test("replay: real pass dates, or the no-radar sentence", () => {
    const wa = bundle({ data_dates: { imerg: "2025-12-20", nisar_pre: "2025-12-04", nisar_post: "2025-12-16" },
      manifest: { event: "wa_2025", layers: [], forecast_source: "perfect-forecast" } });
    const rows = sourceRows(wa, Date.now());
    expect(rows.find((r) => r.id === "nisar")!.date).toBe("Dec 4, 2025 and Dec 16, 2025");
    // Perfect forecast is only ever named as the upper bound.
    expect(rows.find((r) => r.id === "forecast")!.date).toBe("perfect forecast · upper bound");
    expect(rows[0].age).toBeUndefined();
    expect(sourceRows(bundle()).find((r) => r.id === "nisar")!.date).toBe("No radar for this event (before NISAR launch)");
  });

  test("replay with an issued GFS run: the source names it; perfect forecast is the labelled chart upper bound", () => {
    const rs = bundle({
      id: "rs_2024", reference_date: "2024-05-02",
      manifest: { event: "rs_2024", forecast_source: "perfect-forecast", layers: [
        { id: "tpi_flood_d1", date: "2024-05-03", png: "a.png", forecast: true, forecast_source: "perfect-forecast", upper_bound: true },
        { id: "tpi_flood_gfs_d1", date: "2024-05-03", png: "b.png", forecast: true, issued: "2024-05-02", forecast_source: "noaa-gfs" },
      ] },
      series: { event: "rs-2024-05", reference_date: "2024-05-02", days: [
        { date: "2024-05-02", offset: 0, kind: "observed", tpi: 1, imerg_mm: 290, smap: 0.88 },
        { date: "2024-05-03", offset: 1, kind: "forecast", tpi: 1, imerg_mm: 342, smap: 0.93 },
      ] },
    });
    expect(sourceRows(rs).find((r) => r.id === "forecast")!.date)
      .toBe("NOAA GFS (issued May 2, 2024) · chart: perfect forecast · upper bound");
    expect(issuedForecastLabel(rs)).toBe("NOAA GFS (issued May 2, 2024)");
    expect(chartForecastLabel(rs)).toBe("perfect forecast · upper bound");
  });
});

describe("capAlertList (A10 page budget)", () => {
  const card = (i: number, level: string, region: string) =>
    ({ id: `a${i}`, title: "t", area: region, region, hazard: "landslide", level, guidance: "g" }) as never;
  const many = { state: "alerts" as const, alerts: [
    ...Array.from({ length: 30 }, (_, i) => card(i, "emergency", "Porto Alegre")),
    ...Array.from({ length: 5 }, (_, i) => card(100 + i, "warning", "Canoas")),
  ], dataTime: "2026-11-15T04:15:23Z" };

  test("sends the first cards, keeps the exact total and per-region counts", () => {
    const capped = capAlertList(many, 20);
    expect(capped.alerts).toHaveLength(20);
    expect(capped.total).toBe(35);
    expect(capped.regions).toEqual([
      { region: "Porto Alegre", level: "emergency", count: 30 },
      { region: "Canoas", level: "warning", count: 5 },
    ]);
    expect(moreAlertsText(capped)).toBe("and 15 more alerts of the same run");
  });

  test("a short list is unchanged", () => {
    const few = { ...many, alerts: many.alerts.slice(0, 3) };
    expect(capAlertList(few, 20)).toBe(few);
    expect(moreAlertsText(few)).toBeUndefined();
  });
});

describe("alerts paused until the live run is verified", () => {
  test("paused unless verified: true and not alerts_paused; env forces a pause", () => {
    expect(alertsPaused(undefined, undefined)).toBe(true);
    expect(alertsPaused({ mode: "live" }, undefined)).toBe(true); // no flag = paused
    expect(alertsPaused({ verified: false }, undefined)).toBe(true);
    expect(alertsPaused({ verified: true, alerts_paused: true }, undefined)).toBe(true);
    expect(alertsPaused({ verified: true }, undefined)).toBe(false);
    expect(alertsPaused({ verified: true }, "1")).toBe(true);
  });

  test("a paused list carries no card, keeps the run time", () => {
    const p = pausedAlertList({ state: "alerts", alerts: [{ id: "x" } as never], dataTime: "2026-11-15T04:15:23Z" });
    expect(p).toEqual({ state: "paused", alerts: [], dataTime: "2026-11-15T04:15:23Z" });
  });
});

describe("lead-live alerts.json (2026-11-15): tpi candidates, observed[], paused", () => {
  const file = {
    candidates: [
      { kind: "tpi", hazard: "flood", class: 3, label: "Crítico", municipality: "Canoas", uf: "RS", area_km2: 4.2, when: "d1" },
      { kind: "observed", hazard: "flood", class: 3, label: "observed flood candidate" },
    ],
    observed: [
      { kind: "observed", hazard: "flood", label: "observed flood candidate", source: "nisar-gcov",
        acquired: "2026-11-06T21:16:03Z", municipality: "Iguape", uf: "SP", area_km2: 3.54, people: 41, polygons: 2 },
      { kind: "observed", hazard: "flood", source: "nisar-gcov", acquired: "2026-11-06T21:16:03Z",
        municipality: "Cananéia", uf: "SP", area_km2: 8.5, people: 343, polygons: 14 },
    ],
  };
  const live = (over: Record<string, unknown> = {}) =>
    liveBundle({ updated_at: "2026-11-15T12:00:00Z", nowAlerts: { ...file, ...over } as never });

  test("only TPI candidates become cards, with place, area and day", () => {
    const list = buildAlertList({ now: live() });
    expect(list.alerts).toHaveLength(1);
    expect(list.alerts[0]).toMatchObject({ region: "Canoas, RS", hazard: "flood", level: "emergency", area_km2: 4.2, when: "d1" });
    expect(list.alerts[0].title).toBe("Tipping Point: CRITICAL flood risk");
  });

  test("paused: true in the file pauses the list", () => {
    expect(buildAlertList({ now: live({ paused: true, paused_reason: "checks failed", candidates: [] }) }).state).toBe("paused");
  });

  test("observed[]: one card per source, top 3 places by area + 'and N more', sums", () => {
    const more = [...file.observed,
      { kind: "observed", source: "nisar-gcov", municipality: "Registro", uf: "SP", area_km2: 2, people: 10, polygons: 1 },
      { kind: "observed", source: "nisar-gcov", municipality: "Pariquera-Açu", uf: "SP", area_km2: 1, people: 5, polygons: 1 },
      { kind: "observed", source: "opera-dswx-s1", municipality: "Viamão", uf: "RS", area_km2: 7.28, people: 49, polygons: 3 }];
    const rows = observedRows(live({ observed: more }));
    expect(rows.map((r) => r.source)).toEqual(["NISAR radar", "OPERA DSWx-S1 radar"]);
    expect(rows[0]).toMatchObject({
      places: "Cananéia, SP · Iguape, SP · Registro, SP and 1 more",
      area: "15.0 km²", people: "399", polygons: 18,
    });
    expect(rows[1].places).toBe("Viamão, RS");
    expect(JSON.stringify(rows)).not.toMatch(/emergency|critical|monitored region/i);
  });

  test("R3 summary: per source, names from the R3 zones (real file of 8fba5e5)", () => {
    const zones = JSON.parse(readFileSync(join(process.cwd(), "test/fixtures/lead/r3_priority_zones.geojson"), "utf8"));
    const summary = JSON.parse(readFileSync(join(process.cwd(), "test/fixtures/lead/r3_summary.json"), "utf8"));
    const b = liveBundle({ responseSources: toResponseSources(summary), observedPlaces: placesBySource(zones) });
    const rows = observedRows(b);
    expect(rows.map((r) => [r.source, r.area, r.people])).toEqual([
      ["OPERA DSWx-S1 radar", "129.5 km²", "494"],
      ["NISAR radar", "12.0 km²", "489"],
    ]);
    expect(rows[1].places).toMatch(/^São Miguel Arcanjo, SP · .+ and \d+ more$|^São Miguel Arcanjo, SP( · [^·]+){0,2}$/);
    for (const r of rows) expect(r.places).not.toBe("municipalities not named yet");
  });

  test("NISAR meta fallback names its places; no names reads plainly; replay has none", () => {
    const meta = { source: "nisar-gcov", flooded_km2: 12.06, people_flooded: 384, post_acquired: "2026-11-06T21:16:03Z", polygons: 16 };
    expect(observedRows(liveBundle({ response: meta, observedPlaces: { "nisar-gcov": ["São Miguel Arcanjo, SP"] } }))[0])
      .toMatchObject({ source: "NISAR radar", places: "São Miguel Arcanjo, SP", area: "12.1 km²", people: "384",
        acquired: "Nov 6, 06:16 PM BRT", polygons: 16 });
    expect(observedRows(liveBundle({ response: meta }))[0].places).toBe("municipalities not named yet");
    expect(observedRows(bundle({ response: meta }))).toEqual([]);
  });
});

describe("live forecast source row (L30)", () => {
  test("NOAA GFS from gfs_issued; an old run never names GEOS-FP", () => {
    const gfs = sourceRows(liveBundle({ data_dates: { gfs_issued: "2026-11-15T00:00:00Z" } }));
    expect(gfs.find((r) => r.id === "gfs")).toMatchObject({ name: "NOAA GFS forecast", missing: false });
    const old = sourceRows(liveBundle({ data_dates: { geos_fp_issued: "2026-11-14T12:00:00Z" } }));
    expect(old.find((r) => r.id === "gfs")).toMatchObject({ name: "NOAA GFS forecast", missing: true });
    expect(JSON.stringify(old)).not.toContain("GEOS");
  });
});

describe("observed cards precomputed on the server", () => {
  test("a bundle carrying observedSummary uses it as-is (the raw list is not sent)", () => {
    const rows = [{ key: "k", source: "NISAR radar", places: "Iguape, SP", area: "1.0 km²" }];
    expect(observedRows(liveBundle({ observedSummary: rows }))).toBe(rows);
  });
});

describe("observed: flood from R3 (standard confidence), DIST landslide in its own section", () => {
  test("R3 totals win over observed[] for flood; DIST entries become landslide rows", () => {
    const b = liveBundle({
      responseSources: [{ source: "opera-dswx-s1", flooded_km2: 129.5, people_flooded: 494 }],
      observedPlaces: { "opera-dswx-s1": ["Iguatemi, MS"] },
      nowAlerts: { observed: [
        { kind: "observed", hazard: "flood", source: "opera-dswx-s1", municipality: "Avaré", uf: "SP", area_km2: 288.1 },
        { kind: "observed", hazard: "landslide", source: "opera-dist-alert-hls", municipality: "Saudades", uf: "SC", area_km2: 3.3, people: 70, polygons: 685 },
      ] } as never,
    });
    const rows = observedRows(b);
    expect(rows.map((r) => [r.hazard, r.source, r.area])).toEqual([
      ["flood", "OPERA DSWx-S1 radar", "129.5 km²"],
      ["landslide", "OPERA DIST-ALERT-HLS (optical, vegetation loss)", "3.3 km²"],
    ]);
  });
});
