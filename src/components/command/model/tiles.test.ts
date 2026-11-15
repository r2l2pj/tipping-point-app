// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { LIST_COLLAPSED, pinAreas, priorityAreas } from "./areas";
import { bundle, liveBundle, zone, zones } from "./fixtures";
import { criticalAreaTile, peopleTile } from "./tiles";

describe("priority areas", () => {
  const b = bundle({ zones: zones([
    zone(2, { name: "Everett", people: 1200 }), zone(1), zone(3),
    { type: "Feature", properties: { name: "no rank" }, geometry: { type: "Point", coordinates: [0, 0] } },
  ]) });

  test("sorted by rank; the class comes from the data", () => {
    const areas = priorityAreas(b);
    expect(areas.map((a) => a.rank)).toEqual([1, 2, 3]);
    expect(areas[0].cls).toBe("Critical");
    expect(LIST_COLLAPSED).toBe(5);
  });

  test("zones with the same name show the name and the rank", () => {
    expect(priorityAreas(b).map((a) => a.label)).toEqual(["Darrington #1", "Everett", "Darrington #3"]);
  });

  test("people: null stays null, never 0", () => {
    const areas = priorityAreas(b);
    expect(areas[0].people).toBeNull();
    expect(areas[1].people).toBe(1200);
  });

  test("the pin sits at the center of the zone polygon", () => {
    const [lon, lat] = pinAreas(priorityAreas(b))[0].at!;
    expect(lon).toBeCloseTo(-121.9, 5);
    expect(lat).toBeCloseTo(48.1, 5);
  });

  test("no zones: empty list", () => {
    expect(priorityAreas(bundle())).toEqual([]);
  });
});

describe("tiles", () => {
  test("missing zones or people: null read 'not published yet', never 0", () => {
    const none = bundle({ pending: ["priority_zones"] });
    expect(criticalAreaTile(none, "slide").value).toBe("not published yet");
    expect(peopleTile(none).value).toBe("not published yet");
    const nullPeople = bundle({ zones: zones([zone(1, { people: 300 }), zone(2)]) });
    const tile = peopleTile(nullPeople);
    expect(tile).toMatchObject({ value: "not published yet", missing: true });
    expect(tile.value).not.toMatch(/^0/);
  });

  test("replay: metrics first, else the zone sum labelled 'in priority zones'", () => {
    const withZones = bundle({ zones: zones([zone(1), zone(2, { area_km2: 5.5 }), zone(3, { class: "High" })]) });
    expect(criticalAreaTile(withZones, "slide")).toMatchObject({
      value: "15.5 km²", note: "in priority zones", asOf: "Dec 10, 2025",
    });
    const withMetrics = bundle({ ...withZones, metricsView: { critical_area_km2: 40, people_critical: 8400 } });
    expect(criticalAreaTile(withMetrics, "slide")).toMatchObject({ value: "40.0 km²", note: undefined });
    expect(peopleTile(withMetrics).value).toBe("at least 8,400");
    expect(peopleTile(withMetrics).title).toBe("GPW ~1 km resample, ~12% low");
  });

  test("people sum only when no Critical zone is null", () => {
    const all = bundle({ zones: zones([zone(1, { people: 300 }), zone(2, { people: 450 })]) });
    expect(peopleTile(all)).toMatchObject({ value: "at least 750", note: "in priority zones" });
  });

  test("the tiles are dimmed, not recomputed, off the snapshot day", () => {
    const b = bundle({ zones: zones([zone(1)]) });
    expect(criticalAreaTile(b, "slide", "2025-12-10").dimmed).toBe(false);
    const off = criticalAreaTile(b, "slide", "2025-12-12");
    expect(off).toMatchObject({ dimmed: true, value: "10.0 km²" });
  });

  test("the value of the selected day wins, then the metrics scalar with its date", () => {
    const b = bundle({ zones: zones([zone(1)]), metricsView: { critical_km2: 900, critical_km2_date: "2025-12-10", people_critical: 8400 } });
    const day = { date: "2025-12-12", offset: 2, kind: "observed" as const, imerg_mm: 1, smap: 0.5, tpi: 0.9,
      critical_km2: 120.04, critical_slide_km2: 100, critical_flood_km2: 0.02, people_critical: 5300 };
    expect(criticalAreaTile(b, "flood", "2025-12-12", day)).toMatchObject({
      value: "120.0 km²", note: "flood <0.1 km² · landslide 100.0 km²", asOf: "Dec 12, 2025", dimmed: false,
    });
    expect(peopleTile(b, "2025-12-12", day)).toMatchObject({ value: "at least 5,300", asOf: "Dec 12, 2025" });
    const bare = { ...day, critical_km2: undefined, people_critical: -2.3e38 };
    expect(criticalAreaTile(b, "slide", "2025-12-12", bare)).toMatchObject({
      value: "900.0 km²", asOf: "Dec 10, 2025", dimmed: true,
    });
    // A raster fill value is not a head count.
    expect(peopleTile(b, "2025-12-12", bare).value).toBe("at least 8,400");
  });

  test("now: values of the summary for the chosen hazard", () => {
    const now = liveBundle({
      updated_at: "2026-11-14T15:00:00Z",
      summary: { critical_km2: { slide: 12.5, flood: 3, any: 14 }, people_critical: 1234 },
    });
    expect(criticalAreaTile(now, "flood")).toMatchObject({ value: "3.0 km²", note: "flood hazard" });
    expect(peopleTile(now).value).toBe("1,200");
    expect(criticalAreaTile(liveBundle(), "slide").value).toBe("not published yet");
    expect(peopleTile(liveBundle({ summary: {} })).missing).toBe(true);
  });
});

describe("live summary v3 (lead-analysis 022dbd6: strict critical, alert_km2)", () => {
  const summary = {
    updated_at: "2026-11-15T12:00:00Z",
    critical_km2: { slide: 0, flood: 122.5, any: 122.5 },
    alert_km2: { slide: 26.3, flood: 225.5, any: 251.7 },
    people_critical: 1200, people_alert: 9000, people_exposed: 9000,
    classes_km2: { landslide: { Baixo: 1, Moderado: 1, Alto: 26.3, Crítico: 0 }, flood: { Baixo: 1, Moderado: 1, Alto: 103, Crítico: 122.5 } },
  };
  test("Critical area = strict critical_km2, labelled Brazilian land only", () => {
    const t = criticalAreaTile(liveBundle({ summary } as never), "flood");
    expect(t.value).toBe("122.5 km²");
    expect(t.note).toBe("flood hazard · Brazilian land only");
  });
  test("people = Critical only, today or tomorrow (never the High+ count)", () => {
    const t = peopleTile(liveBundle({ summary } as never));
    expect(t.value).toContain("1,200");
    expect(t.note).toBe("in Critical areas, today or tomorrow");
  });
});
