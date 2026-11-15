// L52 — replay city finder: the adapter from a case's municipal boundaries
// (+ town points) to searchable places, the source picker, the bbox-filtered
// live fallback, and the places_daily observed flood class.
// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";

import { bundle, manifest } from "./fixtures";
import { searchPlaces, type Place } from "./places";
import {
  filterPlacesToBBox,
  placesDailyUrl,
  replayDayClass,
  replayPlacesFrom,
  replaySource,
  type ReplayPlace,
} from "./replayPlaces";
import type { CcBundle } from "./types";

const muniFeature = (props: Record<string, unknown> = {}): GeoJSON.Feature => ({
  type: "Feature",
  properties: { name: "Uruguaiana", code: "4322402", uf: "RS", pop: 117210, teammate_candidates_km2: 12.3, ...props },
  geometry: {
    type: "Polygon",
    coordinates: [[[-57.1, -30.1], [-56.9, -30.1], [-56.9, -29.9], [-57.1, -29.9], [-57.1, -30.1]]],
  },
});

const townFeature = (name: string, extra: Record<string, unknown> = {}): GeoJSON.Feature => ({
  type: "Feature",
  properties: { name, kind: "town", ...extra },
  geometry: { type: "Point", coordinates: [-57.0, -29.75] },
});

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

const withProducts = (products: Record<string, string | null>): CcBundle =>
  bundle({ manifest: manifest([], { products }) });

describe("replayPlacesFrom", () => {
  test("municipal polygons → entries with bbox, centroid, outline, teammate km², code", () => {
    const { places } = replayPlacesFrom(fc([muniFeature()]), null);
    expect(places).toHaveLength(1);
    const p = places[0] as ReplayPlace;
    expect(p.id).toBe("4322402");
    expect(p.name).toBe("Uruguaiana");
    expect(p.uf).toBe("RS");
    expect(p.pop).toBe(117210);
    expect(p.bbox).toEqual([-57.1, -30.1, -56.9, -29.9]);
    expect(p.centroid).toEqual([-57.0, -30.0]);
    expect(p.outline).not.toBeNull();
    expect(p.teammateKm2).toBe(12.3);
    expect(p.code).toBe("4322402");
    // No forecast fields: the card shows no live numbers.
    expect(p.flood.cls).toEqual([]);
    expect(p.alert).toBe(false);
  });

  test("missing uf/pop/teammate fields are tolerated (RS 2024 schema)", () => {
    const { places } = replayPlacesFrom(fc([muniFeature({ uf: undefined, pop: undefined, teammate_candidates_km2: undefined, code: undefined })]), null);
    const p = places[0] as ReplayPlace;
    expect(p.uf).toBe("");
    expect(p.pop).toBeNull();
    expect(p.teammateKm2).toBeNull();
    expect(p.id.startsWith("muni-")).toBe(true);
  });

  test("town points merge in, deduped by name; bad rows dropped", () => {
    const { places } = replayPlacesFrom(
      fc([muniFeature()]),
      fc([townFeature("Itaqui"), townFeature("Uruguaiana"), { type: "Feature", properties: {}, geometry: null } as GeoJSON.Feature])
    );
    expect(places.map((p) => p.name).sort()).toEqual(["Itaqui", "Uruguaiana"]);
    const town = places.find((p) => p.name === "Itaqui") as ReplayPlace;
    expect(town.centroid).toEqual([-57.0, -29.75]);
    expect(town.outline).toBeNull();
  });

  test("the shared fuzzy search ranks a municipality", () => {
    const { places } = replayPlacesFrom(
      fc([muniFeature(), muniFeature({ name: "Itaqui", code: "4310607" })]),
      null
    );
    expect(searchPlaces(places, "uruguaiana")[0].name).toBe("Uruguaiana");
    expect(searchPlaces(places, "itaqi")[0].name).toBe("Itaqui");
  });
});

describe("replaySource", () => {
  test("declared boundaries + towns → geo urls; towns only works too", () => {
    const b = withProducts({
      municipal_boundaries: "rs/geojson/municipal_boundaries.geojson",
      places: "rs/geojson/places.geojson",
    });
    const s = replaySource(b, "/data/now/places.json");
    expect(s?.kind).toBe("geo");
    if (s?.kind === "geo") {
      expect(s.muni).toContain("municipal_boundaries.geojson");
      expect(s.towns).toContain("places.geojson");
    }
    const onlyTowns = replaySource(withProducts({ places: "rs/geojson/places.geojson" }), undefined);
    expect(onlyTowns?.kind).toBe("geo");
  });

  test("no case files → the live list filtered to the bbox; none at all → hidden", () => {
    const s = replaySource(withProducts({}), "/data/now/places.json");
    expect(s).toEqual({ kind: "live-box", url: "/data/now/places.json", bbox: [-122.6, 47.0, -121.5, 48.5] });
    expect(replaySource(withProducts({}), undefined)).toBeUndefined();
    expect(replaySource(withProducts({ municipal_boundaries: null, places: null }), undefined)).toBeUndefined();
  });
});

describe("filterPlacesToBBox", () => {
  const live: Place = {
    id: "1", name: "Encantado", uf: "RS", centroid: [-51.87, -29.24],
    bbox: [-52, -29.3, -51.8, -29.1], pop: 100,
    flood: { cls: [], max: [] }, slide: { cls: [], max: [] },
    pTrigger: {}, alert: false, alertLevel: null, alertHazard: null,
    peopleHigh: null, key: "encantado rs",
  };
  test("keeps entries whose centroid is inside the case bounds", () => {
    const inside = { ...live, centroid: [-51.5, -29.0] as [number, number] };
    const outside = { ...live, id: "2", centroid: [-55.0, -33.0] as [number, number] };
    const out = filterPlacesToBBox({ dates: [], places: [inside, outside] }, [-53, -30, -50, -28]);
    expect(out.places).toHaveLength(1);
    expect(out.places[0].id).toBe("1");
  });
});

describe("places_daily", () => {
  const daily = {
    schema: "tipping-point/places-daily@1",
    places: {
      "4322402": { observed: { "2026-10-12": { flood_class_max: 2, tpi_max: 0.8, people_high: 300 } } },
    },
  };
  test("the shown day's observed flood class by IBGE code", () => {
    expect(replayDayClass(daily, "4322402", "2026-10-12")).toBe(2);
    expect(replayDayClass(daily, "4322402", "2026-10-13")).toBeNull();
    expect(replayDayClass(daily, "999", "2026-10-12")).toBeNull();
    expect(replayDayClass(daily, null, "2026-10-12")).toBeNull();
    expect(replayDayClass(null, "4322402", "2026-10-12")).toBeNull();
  });
  test("places_daily resolves only when declared", () => {
    expect(placesDailyUrl(withProducts({ places_daily: "rs/places_daily.json" }))).toContain("places_daily.json");
    expect(placesDailyUrl(withProducts({ places_daily: null }))).toBeUndefined();
    expect(placesDailyUrl(withProducts({}))).toBeUndefined();
  });
});

test("a town point fills the polygon's missing pop / code (WA places + county-less polygons)", async () => {
  const { replayPlacesFrom } = await import("./replayPlaces");
  const poly = { type: "Feature", properties: { name: "Mount Vernon" }, geometry: { type: "Polygon", coordinates: [[[-122.4, 48.4], [-122.3, 48.4], [-122.3, 48.45], [-122.4, 48.45], [-122.4, 48.4]]] } };
  const pt = { type: "Feature", properties: { name: "Mount Vernon", code: "5347560", pop: 35000, state: "WA" }, geometry: { type: "Point", coordinates: [-122.33, 48.42] } };
  const r = replayPlacesFrom({ type: "FeatureCollection", features: [poly] } as never, { type: "FeatureCollection", features: [pt] } as never);
  expect(r.places).toHaveLength(1);
  expect(r.places[0]).toMatchObject({ name: "Mount Vernon", pop: 35000, code: "5347560" });
});
