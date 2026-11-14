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
    expect(peopleTile(withMetrics).value).toBe("8,400");
  });

  test("people sum only when no Critical zone is null", () => {
    const all = bundle({ zones: zones([zone(1, { people: 300 }), zone(2, { people: 450 })]) });
    expect(peopleTile(all)).toMatchObject({ value: "800", note: "in priority zones" });
  });

  test("the tiles are dimmed, not recomputed, off the snapshot day", () => {
    const b = bundle({ zones: zones([zone(1)]) });
    expect(criticalAreaTile(b, "slide", "2025-12-10").dimmed).toBe(false);
    const off = criticalAreaTile(b, "slide", "2025-12-12");
    expect(off).toMatchObject({ dimmed: true, value: "10.0 km²" });
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
