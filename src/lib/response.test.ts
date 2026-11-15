// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { responseGeojsonPath, toNowResponse } from "./response";

const META = {
  source: "nisar-gcov",
  latest_acquired: "2026-11-06T21:16:03Z",
  latency_h: 99.7,
  pairs: [
    { pre_acquired: "2026-10-01T21:16:03Z", post_acquired: "2026-10-13T21:16:03Z" },
    { pre_acquired: "2026-10-25T21:16:03Z", post_acquired: "2026-11-06T21:16:03Z" },
  ],
  flooded_km2: 12.06,
  people_flooded: 384,
  _null_reasons: {},
  n_polygons: 16,
  geojson: "flood_nisar.geojson",
  method: { hand: "/home/someone/data/hand_m.tif" },
};

describe("toNowResponse", () => {
  test("reads the numbers and the newest pair; drops internal method fields", () => {
    const r = toNowResponse(META)!;
    expect(r).toMatchObject({ flooded_km2: 12.06, people_flooded: 384, latency_h: 99.7, polygons: 16,
      pre_acquired: "2026-10-25T21:16:03Z", post_acquired: "2026-11-06T21:16:03Z" });
    expect(r.null_reasons).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain("/home/");
  });

  test("null numbers keep their reasons; junk is not a response", () => {
    const r = toNowResponse({ flooded_km2: null, _null_reasons: { flooded_km2: "no new NISAR pair" } })!;
    expect(r.flooded_km2).toBeUndefined();
    expect(r.null_reasons).toEqual({ flooded_km2: "no new NISAR pair" });
    expect(toNowResponse(null)).toBeUndefined();
    expect(toNowResponse([])).toBeUndefined();
    expect(toNowResponse({})).toBeUndefined();
  });
});

describe("responseGeojsonPath", () => {
  const r = toNowResponse(META)!;
  test("declared flood_nisar wins", () => {
    expect(responseGeojsonPath({ flood_nisar: "response/x.geojson" }, r)).toBe("response/x.geojson");
  });
  test("else the meta's geojson next to the meta file", () => {
    expect(responseGeojsonPath(undefined, r)).toBe("response/flood_nisar.geojson");
    expect(responseGeojsonPath({ nisar_meta: "r2/meta.json" }, r)).toBe("r2/flood_nisar.geojson");
  });
});
