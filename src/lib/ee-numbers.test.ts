// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { afterEach, describe, expect, test } from "bun:test";

import { GET } from "../app/api/numbers/route";
import {
  clearNumbersCache,
  createNumbersService,
  CredsError,
  type EeLike,
  getNumbers,
  NumbersNotFoundError,
  NumbersServiceError,
  NumbersTimeoutError,
  setNumbersServiceForTest,
} from "./ee-numbers";
import type { NumbersResult } from "./ee-numbers";

// Fake ee module that records every chained call so we can assert asset ids,
// band selection, masks and reduceRegion usage without credentials.
type Call = [string, ...unknown[]];

interface FakeOpts {
  bands?: string[]; // band ids on the tpi asset
  props?: Record<string, unknown>; // asset properties on the tpi asset
  tpiError?: string; // error passed to the tpi getInfo callback
  floodBands?: string[]; // band ids on the flood asset
  floodError?: string; // flood getInfo fails (asset absent per case)
  sums?: number[]; // reduceRegion results, dequeued in call order
  hang?: boolean; // getInfo never calls back — exercises withTimeout
}

function makeFakeEe(o: FakeOpts = {}) {
  const calls: Call[] = [];
  const bands = o.bands ?? ["20240501"];
  const sums = [...(o.sums ?? [])];

  type EeImage = ReturnType<EeLike["Image"]>;
  const makeImage = (id: string): EeImage => {
    const img: Record<string, unknown> = {};
    img.select = (band: string) => (calls.push(["select", band]), img);
    img.gte = (v: number) => (calls.push(["gte", v]), img);
    img.neq = (v: number) => (calls.push(["neq", v]), img);
    img.updateMask = () => (calls.push(["updateMask"]), img);
    img.reduceRegion = (params: unknown) => {
      calls.push(["reduceRegion", params]);
      return {
        getInfo: (cb: (d: unknown, e?: string) => void) => {
          if (o.hang) return;
          cb({ sum: sums.length ? sums.shift() : 0 });
        },
      };
    };
    img.getInfo = (cb: (d: unknown, e?: string) => void) => {
      if (o.hang) return;
      if (id.includes("flood")) {
        if (o.floodError) return cb(undefined, o.floodError);
        return cb({
          bands: (o.floodBands ?? []).map((b) => ({ id: b })),
          properties: {},
        });
      }
      if (o.tpiError) return cb(undefined, o.tpiError);
      cb({ bands: bands.map((b) => ({ id: b })), properties: o.props ?? {} });
    };
    return img as unknown as EeImage;
  };

  const Image = ((id: string) => {
    calls.push(["Image", id]);
    return makeImage(id);
  }) as unknown as EeLike["Image"];
  Image.pixelArea = () => {
    calls.push(["pixelArea"]);
    return makeImage("pixelArea");
  };

  const ee = {
    Image,
    ImageCollection: (id: string) => {
      calls.push(["ImageCollection", id]);
      const col: Record<string, unknown> = {};
      col.sort = (prop: string, asc?: boolean) => (
        calls.push(["sort", prop, asc]), col
      );
      col.first = () => (calls.push(["first"]), makeImage("pop"));
      return col;
    },
    Reducer: { sum: () => (calls.push(["Reducer.sum"]), "sum") },
    Geometry: {
      Rectangle: (bounds: number[]) => (calls.push(["Rectangle", bounds]), { bounds }),
    },
  } as unknown as EeLike;

  return { ee, calls };
}

const SA_ENVS = ["GCP_SA_KEY", "GEE_SERVICE_ACCOUNT_KEY"] as const;

// Run fn with env keys deleted (they could leak in from .env / the shell).
async function withoutEnv<T>(
  keys: readonly string[],
  fn: () => T | Promise<T>
): Promise<T> {
  const saved = keys.map((k) => [k, process.env[k]] as const);
  for (const k of keys) delete process.env[k];
  try {
    return await fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const QUERY = { caseId: "rs-2024-05", date: "2024-05-01" } as const;
const NO_LAYERS = () => undefined;

describe("createNumbersService", () => {
  afterEach(() => clearNumbersCache());

  test("manifest-declared tpi/flood assets win over the convention", async () => {
    const { ee, calls } = makeFakeEe({
      props: { km2_critical: 1 },
      floodBands: ["20240501"],
      sums: [1, 2, 3, 4],
    });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: () => [
        { id: "tpi_slide", date: "2024-05-01", asset: "custom/tpi" },
        { id: "flood_confirmed", asset: "custom/flood" },
      ],
    });
    await svc.getNumbers(QUERY);
    expect(calls[0]).toEqual(["Image", "custom/tpi"]);
  });

  test("convention asset ids when the manifest declares none", async () => {
    const { ee, calls } = makeFakeEe({ props: { km2_critical: 1 } });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
    });
    await svc.getNumbers(QUERY);
    expect(calls[0]).toEqual(["Image", "root/rs_2024/tpi_slide_series"]);
  });

  test("properties path returns job numbers verbatim, never reduceRegion", async () => {
    const { ee, calls } = makeFakeEe({
      props: {
        km2_critical: 12.5,
        people_exposed: 900,
        flooded_km2: 3.2,
        people_flooded: 40,
        data_date: "2024-05-01",
      },
    });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
    });
    const res = await svc.getNumbers(QUERY);
    expect(res).toEqual({
      case: "rs_2024",
      date: "2024-05-01",
      km2_critical: 12.5,
      people_exposed: 900,
      flooded_km2: 3.2,
      people_flooded: 40,
      data_date: "2024-05-01",
      source: "properties",
    });
    expect(calls.filter((c) => c[0] === "reduceRegion")).toHaveLength(0);
    expect(calls.filter((c) => c[0] === "pixelArea")).toHaveLength(0);
  });

  test("properties path reads a nested `numbers` dict", async () => {
    const { ee } = makeFakeEe({
      props: { numbers: { km2_critical: 7, people_exposed: 11 } },
    });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
    });
    const res = await svc.getNumbers(QUERY);
    expect(res.source).toBe("properties");
    expect(res.km2_critical).toBe(7);
    expect(res.people_exposed).toBe(11);
    expect(res.flooded_km2).toBeUndefined();
  });

  test("computed path: gte(0.6) mask, pixelArea/1e6, GPW population", async () => {
    const { ee, calls } = makeFakeEe({
      sums: [2_000_000, 5_000], // area m² then people; no flood asset
      floodError: "asset does not exist",
    });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
    });
    const res = await withoutEnv(["GEE_POP_IMAGE"], () =>
      svc.getNumbers(QUERY)
    );
    expect(calls).toContainEqual(["select", "20240501"]);
    expect(calls).toContainEqual(["gte", 0.6]);
    expect(calls).toContainEqual(["pixelArea"]);
    expect(calls).toContainEqual([
      "ImageCollection",
      "CIESIN/GPWv411/GPW_Population_Count",
    ]);
    expect(calls).toContainEqual(["sort", "system:time_start", false]);
    expect(calls).toContainEqual(["first"]);
    expect(calls.filter((c) => c[0] === "reduceRegion")).toHaveLength(2);
    const reduce = calls.find((c) => c[0] === "reduceRegion");
    expect(reduce?.[1]).toMatchObject({
      scale: 1000,
      bestEffort: true,
      maxPixels: 1e9,
    });
    expect(res).toMatchObject({
      case: "rs_2024",
      date: "2024-05-01",
      km2_critical: 2,
      people_exposed: 5_000,
      source: "computed",
    });
    expect(res.flooded_km2).toBeUndefined();
    expect(res.people_flooded).toBeUndefined();
  });

  test("computed path selects dYYYYMMDD window-end bands for TPI and flood", async () => {
    const { ee, calls } = makeFakeEe({
      bands: ["d20240421", "d20240422"],
      floodBands: ["d20240421", "d20240422"],
      sums: [2_000_000, 5_000, 400_000, 300],
    });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
      popImage: "pop/img",
    });
    const res = await svc.getNumbers({ ...QUERY, date: "2024-04-22" });
    expect(calls.filter((c) => c[0] === "select")).toEqual([
      ["select", "d20240422"],
      ["select", "d20240422"],
    ]);
    expect(calls.filter((c) => c[0] === "reduceRegion")).toHaveLength(4);
    expect(res).toMatchObject({
      source: "computed",
      km2_critical: 2,
      people_exposed: 5_000,
      flooded_km2: 0.4,
      people_flooded: 300,
    });
  });

  test("computed reductions all receive the manifest case rectangle", async () => {
    const { ee, calls } = makeFakeEe({
      floodBands: ["20240501"],
      sums: [2_000_000, 5_000, 400_000, 300],
    });
    await withoutEnv(["DATA_BASE_URL"], () => createNumbersService(ee, {
      assetRoot: "root",
      popImage: "pop/img",
    }).getNumbers(QUERY));
    expect(calls).toContainEqual(["Rectangle", [-52.5, -30.5, -50.5, -29]]);
    const reductions = calls.filter((c) => c[0] === "reduceRegion");
    expect(reductions).toHaveLength(4);
    for (const call of reductions) {
      expect(call[1]).toMatchObject({ geometry: { bounds: [-52.5, -30.5, -50.5, -29] } });
    }
  });

  test("GEE_POP_IMAGE override uses an Image instead of the collection", async () => {
    const { ee, calls } = makeFakeEe({
      sums: [1_000_000, 10],
      floodError: "missing",
    });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
      popImage: "users/test/pop_2024",
    });
    await svc.getNumbers(QUERY);
    expect(calls).toContainEqual(["Image", "users/test/pop_2024"]);
    expect(calls.filter((c) => c[0] === "ImageCollection")).toHaveLength(0);
  });

  test("flood asset present: nonzero mask yields flooded fields", async () => {
    const { ee, calls } = makeFakeEe({
      sums: [2_000_000, 5_000, 400_000, 300],
      floodBands: ["20240501"],
    });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
      popImage: "pop/img",
    });
    const res = await svc.getNumbers(QUERY);
    expect(calls).toContainEqual([
      "Image",
      "root/rs_2024/flood_confirmed",
    ]);
    expect(calls).toContainEqual(["neq", 0]);
    expect(res.flooded_km2).toBe(0.4);
    expect(res.people_flooded).toBe(300);
  });

  test("missing date band -> NumbersNotFoundError", async () => {
    const { ee } = makeFakeEe({ bands: ["20240502"] });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
    });
    const err = await svc.getNumbers(QUERY).then(
      () => null,
      (e) => e as Error
    );
    expect(err).toBeInstanceOf(NumbersNotFoundError);
    expect(err?.message).toContain("20240501");
  });

  test("dashed band id is accepted as a fallback", async () => {
    const { ee, calls } = makeFakeEe({
      bands: ["2024-05-01"],
      props: { km2_critical: 3 },
    });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
    });
    const res = await svc.getNumbers(QUERY);
    expect(res.km2_critical).toBe(3);
    expect(calls[0]).toEqual(["Image", "root/rs_2024/tpi_slide_series"]);
  });

  test("tpi getInfo 'not found' -> NotFound; other errors -> ServiceError", async () => {
    const { ee } = makeFakeEe({ tpiError: "Image not found" });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
    });
    const err = await svc.getNumbers(QUERY).then(
      () => null,
      (e) => e as Error
    );
    expect(err).toBeInstanceOf(NumbersNotFoundError);

    // Module-level cache is keyed case|date only — reset before the second
    // service or the negative-cached error above would be replayed.
    clearNumbersCache();
    const { ee: ee2 } = makeFakeEe({ tpiError: "quota exceeded" });
    const svc2 = createNumbersService(ee2, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
    });
    const err2 = await svc2.getNumbers(QUERY).then(
      () => null,
      (e) => e as Error
    );
    expect(err2).toBeInstanceOf(NumbersServiceError);
  });

  test("cache hit does not touch ee again", async () => {
    const { ee, calls } = makeFakeEe({ props: { km2_critical: 1 } });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
    });
    await svc.getNumbers(QUERY);
    const n = calls.length;
    const res = await svc.getNumbers(QUERY);
    expect(calls.length).toBe(n);
    expect(res.km2_critical).toBe(1);
  });

  test("failures negative-cache for the short TTL", async () => {
    const { ee, calls } = makeFakeEe({ bands: ["20240502"] });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
    });
    await svc.getNumbers(QUERY).catch(() => {});
    const n = calls.length;
    const err = await svc.getNumbers(QUERY).then(
      () => null,
      (e) => e as Error
    );
    expect(err).toBeInstanceOf(NumbersNotFoundError);
    expect(calls.length).toBe(n);
  });

  test("hung ee roundtrip -> NumbersTimeoutError", async () => {
    const { ee } = makeFakeEe({ hang: true });
    const svc = createNumbersService(ee, {
      assetRoot: "root",
      bounds: [-58, -34, -49, -27],
      manifestLayers: NO_LAYERS,
      timeoutMs: 5,
    });
    const err = await svc.getNumbers(QUERY).then(
      () => null,
      (e) => e as Error
    );
    expect(err).toBeInstanceOf(NumbersTimeoutError);
  });
});

describe("getNumbers (credentialed entry)", () => {
  afterEach(() => setNumbersServiceForTest(undefined));

  test("no service-account env -> CredsError", async () => {
    const err = await withoutEnv(SA_ENVS, () =>
      getNumbers(QUERY).then(
        () => null,
        (e) => e as Error
      )
    );
    expect(err).toBeInstanceOf(CredsError);
  });
});

describe("GET /api/numbers", () => {
  const req = (qs: string) => new Request(`http://localhost/api/numbers?${qs}`);

  afterEach(() => setNumbersServiceForTest(undefined));

  // Drive the route past the creds check with a fake key + injected service.
  async function withService<T>(
    impl: () => Promise<NumbersResult>,
    fn: () => Promise<T>
  ): Promise<T> {
    const saved = process.env.GCP_SA_KEY;
    process.env.GCP_SA_KEY = "test-key";
    setNumbersServiceForTest({ getNumbers: impl });
    try {
      return await fn();
    } finally {
      setNumbersServiceForTest(undefined);
      if (saved === undefined) delete process.env.GCP_SA_KEY;
      else process.env.GCP_SA_KEY = saved;
    }
  }

  test("missing case -> 400 naming the param", async () => {
    const res = await GET(req("date=2024-05-01"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("case");
  });

  test("bad date -> 400 naming the param", async () => {
    const res = await GET(req("case=rs_2024&date=2024/05/01"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("date");
  });

  test("no service-account env -> 503 gee unavailable", async () => {
    const res = await withoutEnv(SA_ENVS, () =>
      GET(req("case=rs_2024&date=2024-05-01"))
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("gee unavailable");
  });

  test("not found -> 404", async () => {
    const res = await withService(
      () => Promise.reject(new NumbersNotFoundError("no band 20240501")),
      () => GET(req("case=rs_2024&date=2024-05-01"))
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain("20240501");
  });

  test("success -> 200 with the numbers payload", async () => {
    const body: NumbersResult = {
      case: "rs_2024",
      date: "2024-05-01",
      km2_critical: 2,
      people_exposed: 5000,
      source: "computed",
    };
    const res = await withService(
      () => Promise.resolve(body),
      () => GET(req("case=rs-2024-05&date=2024-05-01"))
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(body);
  });

  test("replay case -> 7d edge cache; now -> 5m; errors -> no-store", async () => {
    const body: NumbersResult = {
      case: "now",
      date: "2026-11-14",
      km2_critical: 1,
      people_exposed: 10,
      source: "computed",
    };
    const replay = await withService(
      () => Promise.resolve({ ...body, case: "rs_2024" }),
      () => GET(req("case=rs-2024-05&date=2024-05-01"))
    );
    expect(replay.headers.get("cache-control")).toBe(
      "public, s-maxage=604800, stale-while-revalidate=86400"
    );

    const now = await withService(
      () => Promise.resolve(body),
      () => GET(req("case=now&date=2026-11-14"))
    );
    expect(now.status).toBe(200);
    expect(now.headers.get("cache-control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=60"
    );

    const badReq = await GET(req("case=rs_2024&date=2024/05/01"));
    expect(badReq.status).toBe(400);
    expect(badReq.headers.get("cache-control")).toBe("no-store");

    const notFound = await withService(
      () => Promise.reject(new NumbersNotFoundError("no band 20240501")),
      () => GET(req("case=rs_2024&date=2024-05-01"))
    );
    expect(notFound.status).toBe(404);
    expect(notFound.headers.get("cache-control")).toBe("no-store");
  });
});
