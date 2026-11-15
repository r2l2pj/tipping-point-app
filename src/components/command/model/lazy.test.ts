// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { bundle, liveBundle, point, zone, zones } from "./fixtures";
import { declared, effectiveBundle, productUrl, withLazy, zonesAreTrimmed } from "./lazy";
import { priorityAreas } from "./areas";
import { criticalAreaTile } from "./tiles";

const trimmed = (n: number) => zones(Array.from({ length: n }, (_, i) => ({
  ...zone(i + 1, { area_km2: 2 }),
  geometry: { type: "Point" as const, coordinates: [-122 + i * 0.01, 48] },
})));

describe("products by URL", () => {
  const wa = bundle({
    products: { priority_zones: "wa_2025/geojson/priority_zones.geojson", landslide_candidates: null } as never,
  });

  test("only a declared file has a URL: null and undeclared fetch nothing", () => {
    expect(declared(wa, "priority_zones")).toBe(true);
    expect(productUrl(wa, "priority_zones")).toBe("/data/wa_2025/geojson/priority_zones.geojson");
    expect(productUrl(wa, "landslide_candidates")).toBeUndefined();
    expect(productUrl(liveBundle(), "flood_confirmed")).toBeUndefined();
  });

  test("the remote base of the bundle is used when published", () => {
    expect(productUrl({ ...wa, assetBase: "https://host/data" }, "priority_zones"))
      .toBe("https://host/data/wa_2025/geojson/priority_zones.geojson");
  });
});

describe("pending tokens win over values", () => {
  test("a listed output is treated as absent", () => {
    const b = bundle({
      metricsView: { iou: 0.7 }, zones: zones([zone(1)]),
      scars: { type: "FeatureCollection", features: [point()] },
      pending: ["metrics", "landslide_candidates"],
    });
    const e = effectiveBundle(b);
    expect(e.metricsView).toBeUndefined();
    expect(e.scars).toBeUndefined();
    expect(e.zones).toBe(b.zones);
    expect(effectiveBundle(bundle())).toEqual(bundle());
  });
});

describe("zones: trimmed inline copy, then the full file", () => {
  const b = bundle({ zones: trimmed(20) });

  test("the inline copy is recognised as trimmed", () => {
    expect(zonesAreTrimmed(b)).toBe(true);
    expect(zonesAreTrimmed(bundle({ zones: zones([zone(1)]) }))).toBe(false);
    expect(zonesAreTrimmed(bundle())).toBe(false);
  });

  test("while loading, the sum is labelled as the top-ranked zones only", () => {
    const view = withLazy(b, { zonesRequested: true, zones: undefined });
    expect(view.lazy).toEqual({ priority_zones: "loading" });
    expect(criticalAreaTile(view, "slide")).toMatchObject({
      value: "40.0 km²", note: "in the 20 top-ranked priority zones",
    });
    expect(priorityAreas(view)).toHaveLength(20);
    expect(priorityAreas(view)[0].at).toEqual([-122, 48]);
  });

  test("the full file replaces the trimmed copy", () => {
    const full = zones(Array.from({ length: 44 }, (_, i) => zone(i + 1, { area_km2: 2 })));
    const view = withLazy(b, { zonesRequested: true, zones: full });
    expect(view.zonesTrimmed).toBeUndefined();
    expect(priorityAreas(view)).toHaveLength(44);
    expect(criticalAreaTile(view, "slide")).toMatchObject({ value: "88.0 km²", note: "in priority zones" });
  });

  test("a failed fetch keeps the trimmed copy and its label", () => {
    const view = withLazy(b, { zonesRequested: true, zones: null });
    expect(view.lazy).toEqual({ priority_zones: "missing" });
    expect(view.zonesTrimmed).toBe(true);
  });

  test("scar candidates: loading, missing, loaded", () => {
    expect(withLazy(bundle(), { scarsRequested: true }).lazy).toEqual({ landslide_candidates: "loading" });
    expect(withLazy(bundle(), { scarsRequested: true, scars: null }).lazy).toEqual({ landslide_candidates: "missing" });
    const fc = { type: "FeatureCollection" as const, features: [point()] };
    expect(withLazy(bundle(), { scarsRequested: true, scars: fc }).scars).toBe(fc);
    expect(withLazy(bundle(), {})).toEqual(bundle());
  });
});
