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

  test("most severe first: observed flood, then class, then TPI; numbered in that order", () => {
    const mixed = priorityAreas(bundle({ zones: zones([
      zone(1, { name: "A", class: "High", tpi: 0.5 }),
      zone(2, { name: "B", class: "Critical", tpi: 0.7 }),
      zone(3, { name: "C", class: "Critical", tpi: 0.9 }),
      zone(4, { name: "D", class: "High", tpi: 0.5 }),
    ]) }));
    expect(mixed.map((a) => a.name)).toEqual(["C", "B", "A", "D"]);
    expect(mixed.map((a) => a.rank)).toEqual([1, 2, 3, 4]);
    expect(mixed.map((a) => a.dataRank)).toEqual([3, 2, 1, 4]);
  });

  test("equal severity keeps the rank of the data; the class comes from the data", () => {
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
    expect(peopleTile(withMetrics).value).toBe("8,400 (estimate)");
    expect(peopleTile(withMetrics).title).toBe("GPW v4.11 population count, native 30″ grid, exact cell fractions");
  });

  test("people sum only when no Critical zone is null", () => {
    const all = bundle({ zones: zones([zone(1, { people: 300 }), zone(2, { people: 450 })]) });
    expect(peopleTile(all)).toMatchObject({ value: "750 (estimate)", note: "in priority zones" });
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
      // the tile follows the map hazard (external review)
      value: "<0.1 km²", note: "flood hazard", asOf: "Dec 12, 2025", dimmed: false,
    });
    expect(peopleTile(b, "2025-12-12", day)).toMatchObject({ value: "5,300 (estimate)", asOf: "Dec 12, 2025" });
    const bare = { ...day, critical_km2: undefined, people_critical: -2.3e38 };
    expect(criticalAreaTile(b, "slide", "2025-12-12", bare)).toMatchObject({
      value: "900.0 km²", asOf: "Dec 10, 2025", dimmed: true,
    });
    // A raster fill value is not a head count.
    expect(peopleTile(b, "2025-12-12", bare).value).toBe("8,400 (estimate)");
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

describe("Priority areas people: replay lower bound (conductor)", () => {
  test("replay: exact count with the GPW tooltip; no '≥'", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const PriorityAreas = (await import("../PriorityAreas")).default;
    const areas = [{ rank: 1, label: "Caxias do Sul #1", cls: 3, tpi: 1, people: 7700.6, areaKm2: 1 }] as never;
    const props = { areas, missingText: "", expanded: true, selected: null, dimmed: false, onToggleAll: () => {}, onSelect: () => {} };
    const replay = renderToStaticMarkup(createElement(PriorityAreas, { ...props, lowerBound: true }));
    expect(replay).toContain(">7,701<");
    expect(replay).not.toContain("≥");
    expect(replay).toContain('title="GPW v4.11 population count, native 30″ grid, exact cell fractions"');
    const live = renderToStaticMarkup(createElement(PriorityAreas, props));
    expect(live).not.toContain("≥");
  });
});

describe("people audit (conductor): at-risk part label + impossible values", () => {
  test("Now zone: 'X people in the at-risk part (Y km²) of <municipality>'; −1e40 renders '—'", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const PriorityAreas = (await import("../PriorityAreas")).default;
    const { AreaCard } = await import("../AreaCallout");
    const { priorityAreas } = await import("./areas");
    const b = liveBundle({ zones: zones([
      zone(1, { name: "Florianópolis", people: 29306, area_km2: 38.631 }),
      zone(2, { name: "Bad", people: -1.2e40, area_km2: 3 }),
    ]) });
    const areas = priorityAreas(b);
    expect(areas[1].people).toBeNull();
    expect(areas[1].peopleInvalid).toBe(true);
    const props = { areas, missingText: "", expanded: true, selected: null, dimmed: false, onToggleAll: () => {}, onSelect: () => {}, partsNote: true };
    const html = renderToStaticMarkup(createElement(PriorityAreas, props));
    expect(html).toContain("29,306 people in the at-risk part (38.6 km²) of Florianópolis");
    expect(html).not.toMatch(/e\+40|-1[.,]2/);
    const card = renderToStaticMarkup(createElement(AreaCard, { area: areas[1], partsNote: true, expanded: false, onToggle: () => {}, onClose: () => {} }));
    expect(card).toContain("People: —");
  });
});

describe("Jhonatan: people read against their area", () => {
  test("replay zone: '7,700 people in 12.0 km² (estimate)'; density > 60,000/km² renders '—'", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const PriorityAreas = (await import("../PriorityAreas")).default;
    const { priorityAreas } = await import("./areas");
    const areas = priorityAreas(bundle({ zones: zones([
      zone(1, { name: "Caxias do Sul", people: 7700, area_km2: 12 }),
      zone(2, { name: "Dense", people: 900000, area_km2: 2 }),
    ]) }));
    expect(areas[1].peopleInvalid).toBe(true);
    const html = renderToStaticMarkup(createElement(PriorityAreas, { areas, missingText: "", expanded: true, selected: null, dimmed: false,
      onToggleAll: () => {}, onSelect: () => {}, lowerBound: true }));
    expect(html).toMatch(/7,700(<!-- -->)? people in (<!-- -->)?12\.0 km²(<!-- -->)? \(estimate\)/);
    expect(html).not.toContain("≥");
    expect(html).not.toContain("900,000");
  });
});

describe("external review: replay priority areas off their snapshot day", () => {
  test("says it's the May 2 snapshot and offers 'Go to May 2'", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const PriorityAreas = (await import("../PriorityAreas")).default;
    const { priorityAreas } = await import("./areas");
    const areas = priorityAreas(bundle({ zones: zones([zone(1, { name: "Caxias do Sul", people: 7700, area_km2: 12 })]) }));
    const html = renderToStaticMarkup(createElement(PriorityAreas, { areas, missingText: "", expanded: true, selected: null,
      dimmed: true, asOf: "May 2, 2024", onToggleAll: () => {}, onSelect: () => {}, onJumpToSnapshot: () => {} }));
    expect(html).toContain("These areas are the May 2, 2024 snapshot and do not follow the timeline.");
    expect(html).toContain("Go to May 2, 2024");
  });
});
