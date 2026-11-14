// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  createLayerService,
  getLayerMeta,
  LayersCredsError,
  type EeLike,
} from "./ee-layers";
import type { RootManifest } from "./types";
import { GET } from "../app/api/layers/route";

// Fake ee: `assets` maps an asset id to a getInfo payload, an Error (asset
// absent/fails), or "hang" (getInfo never calls back → timeout path).
function fakeEe(
  assets: Record<string, unknown>,
  requested?: string[]
): EeLike {
  return {
    Image(id: string) {
      requested?.push(id);
      return {
        getInfo(cb: (data: unknown, err?: string) => void) {
          const v = assets[id];
          if (v === "hang") return;
          queueMicrotask(() => {
            if (v instanceof Error) cb(null, v.message);
            else if (v === undefined) cb(null, "Image not found");
            else cb(v);
          });
        },
      };
    },
  };
}

const ROOT = "projects/test-proj/assets/tipping-point";
const asset = (id: string) => `${ROOT}/now/${id}`;
const series = (id: string) => `${ROOT}/now/${id}_series`;

const ENV_KEYS = [
  "GCP_SA_KEY",
  "GEE_SERVICE_ACCOUNT_KEY",
  "GEE_ASSET_ROOT",
  "GEE_PROJECT",
] as const;
function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.GEE_PROJECT = "test-proj";
}

afterEach(() => {
  mock.restore();
  clearEnv();
});

clearEnv();

describe("createLayerService.probe", () => {
  test("series assets: YYYYMMDD bands normalize to sorted YYYY-MM-DD", async () => {
    const ee = fakeEe({
      [series("tpi_slide")]: {
        bands: [{ id: "20240512" }, { id: "20240501" }],
        properties: {
          data_date: "2024-05-12",
          updated_at: "2024-05-13T00:00:00Z",
        },
      },
      [series("imerg")]: {
        bands: [{ id: "2024-05-02" }],
        properties: { updated_at: "2024-05-03T00:00:00Z" },
      },
    });
    const svc = createLayerService(ee, { assetRoot: ROOT, manifest: null });
    const layers = await svc.probe("now", ["tpi_slide", "imerg", "missing"]);

    expect(layers).toHaveLength(2);
    const slide = layers.find((l) => l.id === "tpi_slide")!;
    expect(slide.dates).toEqual(["2024-05-01", "2024-05-12"]);
    expect(slide.data_date).toBe("2024-05-12");
    expect(slide.updated_at).toBe("2024-05-13T00:00:00Z");
    // data_date falls back to updated_at when absent
    const imerg = layers.find((l) => l.id === "imerg")!;
    expect(imerg.data_date).toBe("2024-05-03T00:00:00Z");
  });

  test("falls back to the bare asset when <id>_series is absent", async () => {
    const requested: string[] = [];
    const ee = fakeEe(
      { [asset("flood_confirmed")]: { bands: [{ id: "20240501" }] } },
      requested
    );
    const svc = createLayerService(ee, { assetRoot: ROOT, manifest: null });
    const layers = await svc.probe("now", ["flood_confirmed"]);
    expect(requested).toEqual([
      series("flood_confirmed"),
      asset("flood_confirmed"),
    ]);
    expect(layers[0].dates).toEqual(["2024-05-01"]);
  });

  test("failing and timed-out assets are omitted", async () => {
    const ee = fakeEe({
      [asset("ok")]: { bands: [{ id: "20240101" }] },
      [series("boom")]: new Error("permission denied"),
      [asset("boom")]: new Error("permission denied"),
      [series("slow")]: "hang",
      [asset("slow")]: "hang",
    });
    const svc = createLayerService(ee, {
      assetRoot: ROOT,
      timeoutMs: 30,
      manifest: null,
    });
    const layers = await svc.probe("now", ["ok", "boom", "slow"]);
    expect(layers.map((l) => l.id)).toEqual(["ok"]);
  });

  test("manifest-declared assets merge in as declared:true", async () => {
    const manifest = {
      cases: {
        now: {
          layers: [
            { id: "tpi_slide_d0", date: "2026-11-14", asset: "tpi_slide_d0" },
            { id: "tpi_slide_d1", date: "2026-11-15", asset: "tpi_slide_d1" },
            { id: "no_asset", date: "2026-11-14" },
          ],
        },
      },
    } as unknown as RootManifest;
    const ee = fakeEe({
      // d0 probes fine; d1's asset is missing → declared date reported
      [asset("tpi_slide_d0")]: { bands: [{ id: "20261114" }] },
    });
    const svc = createLayerService(ee, { assetRoot: ROOT, manifest });
    const layers = await svc.probe("now", []);

    const d0 = layers.find((l) => l.id === "tpi_slide_d0")!;
    expect(d0).toMatchObject({
      dates: ["2026-11-14"],
      asset: asset("tpi_slide_d0"),
      declared: true,
    });
    const d1 = layers.find((l) => l.id === "tpi_slide_d1")!;
    expect(d1).toMatchObject({
      dates: ["2026-11-15"],
      declared: true,
    });
    // entries without an asset are not merged
    expect(layers.find((l) => l.id === "no_asset")).toBeUndefined();
  });

  test("declared entries enrich an already-probed layer id", async () => {
    const manifest = {
      cases: {
        now: {
          layers: [
            { id: "tpi_slide", date: "2024-05-01", asset: "tpi_slide_d0" },
          ],
        },
      },
    } as unknown as RootManifest;
    const ee = fakeEe({
      [series("tpi_slide")]: { bands: [{ id: "20240501" }] },
      [asset("tpi_slide_d0")]: { bands: [{ id: "20261114" }] },
    });
    const svc = createLayerService(ee, { assetRoot: ROOT, manifest });
    const layers = await svc.probe("now", ["tpi_slide"]);
    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({
      id: "tpi_slide",
      dates: ["2024-05-01"], // probed series dates win
      asset: asset("tpi_slide_d0"),
      declared: true,
    });
  });
});

describe("getLayerMeta", () => {
  test("canonicalizes the case id and probes the asset root", async () => {
    const requested: string[] = [];
    const ee = fakeEe(
      { [`${ROOT}/rs_2024/tpi_slide`]: { bands: [{ id: "20240501" }] } },
      requested
    );
    const result = await getLayerMeta("rs-2024-05", {
      ee,
      layer: "tpi_slide",
    });
    expect(result.case).toBe("rs_2024");
    expect(result.layers).toHaveLength(1);
    expect(requested).toEqual([
      `${ROOT}/rs_2024/tpi_slide_series`,
      `${ROOT}/rs_2024/tpi_slide`,
    ]);
  });

  test("layer= probes only that asset, no manifest merge", async () => {
    const requested: string[] = [];
    const ee = fakeEe({ [asset("smap")]: { bands: [] } }, requested);
    const result = await getLayerMeta("now", { ee, layer: "smap" });
    expect(requested).toEqual([series("smap"), asset("smap")]);
    expect(result.layers.map((l) => l.id)).toEqual(["smap"]);
  });

  test("full probe result is cached per canonical case", async () => {
    const requested: string[] = [];
    const ee = fakeEe({ [asset("imerg")]: { bands: [] } }, requested);
    const first = await getLayerMeta("now", { ee, manifest: null });
    const callsAfterFirst = requested.length;
    expect(callsAfterFirst).toBeGreaterThan(0);
    const second = await getLayerMeta("now", { ee, manifest: null });
    expect(requested.length).toBe(callsAfterFirst); // no new probes
    expect(second).toBe(first);
  });

  test("no service-account env -> LayersCredsError", async () => {
    await expect(getLayerMeta("now")).rejects.toBeInstanceOf(LayersCredsError);
  });
});

describe("GET /api/layers", () => {
  const get = (url: string) => GET(new Request(url));

  test("missing case param -> 400", async () => {
    const res = await get("http://localhost/api/layers");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: expect.stringContaining("case"),
    });
  });

  test("no credentials -> 503", async () => {
    const res = await get("http://localhost/api/layers?case=now");
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "gee unavailable" });
  });

  test("success -> 200 with case/canonical/layers shape", async () => {
    process.env.GCP_SA_KEY = "{}";
    const layers = [
      { id: "tpi_slide", dates: ["2024-05-01"], data_date: "2024-05-01" },
    ];
    const real = await import("./ee-layers");
    mock.module("@/lib/ee-layers", () => ({
      ...real,
      getLayerMeta: async () => ({ case: "rs_2024", layers }),
    }));

    const res = await get(
      "http://localhost/api/layers?case=rs-2024-05&layer=tpi_slide"
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      case: "rs-2024-05",
      canonical: "rs_2024",
      layers,
    });
  });
});
