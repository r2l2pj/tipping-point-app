// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { bundle, frame, manifest, series } from "./fixtures";
import { fromGeeValues, pointKey, pointRequest, readPoint } from "./pointRead";

const b = bundle({
  series: series([0.5, 0.9]),
  manifest: manifest([
    frame("tpi_slide", "2025-12-10"),
    { id: "r_series", cog: "wa_2025/cog/r.tif" }, { id: "t_flood", cog: "wa_2025/cog/tf.tif" },
  ]),
});

describe("point read", () => {
  test("the request names the case, the date and the published COGs", () => {
    const q = pointRequest(b, "2025-12-10", "flood", [-121.9, 48.1]);
    expect(q).toMatchObject({
      caseId: "wa_2025", date: "2025-12-10", lon: -121.9, lat: 48.1,
      cogUrl: "/data/wa_2025/cog/tpi_slide.tif",
      rstUrls: { r: "/data/wa_2025/cog/r.tif", s: undefined, t: "/data/wa_2025/cog/tf.tif" },
      bandOrder: ["2025-12-10", "2025-12-11"],
    });
    expect(pointKey(q)).toBe("wa_2025|2025-12-10|flood|-121.90000|48.10000");
  });

  test("GEE values keep nulls and follow the hazard", () => {
    const values = { tpi_slide: 0.9, tpi_flood: 0.2, r: 0.8, s: null, t_slide: 0.7, t_flood: 0.1 };
    expect(fromGeeValues(values, "slide")).toEqual({ tpi: 0.9, r: 0.8, s: null, t: 0.7, source: "GEE point read" });
    expect(fromGeeValues(values, "flood")).toMatchObject({ tpi: 0.2, t: 0.1 });
    expect(fromGeeValues({ ...values, r: "0.8" }, "slide")).toBeNull();
    expect(fromGeeValues({ tpi_slide: null, tpi_flood: null, r: null, s: null, t_slide: null, t_flood: null }, "slide")).toBeNull();
  });

  test("the answer of /api/point is used when it is valid", async () => {
    const values = { tpi_slide: 0.9, tpi_flood: null, r: 0.8, s: 0.6, t_slide: 0.7, t_flood: null };
    const fetchOk = (async () => new Response(JSON.stringify({ values }))) as unknown as typeof fetch;
    const q = { ...pointRequest(b, "2025-12-10", "slide", [-121.9, 48.1]), cogUrl: undefined, rstUrls: {} };
    expect(await readPoint(q, fetchOk)).toMatchObject({ r: 0.8, source: "GEE point read" });
  });

  test("no endpoint and no COG: null, never an estimate", async () => {
    const fetchDown = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    const q = { ...pointRequest(b, "2025-12-10", "slide", [-121.9, 48.1]), cogUrl: undefined, rstUrls: {} };
    expect(await readPoint(q, fetchDown)).toBeNull();
  });
});
