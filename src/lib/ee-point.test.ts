// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { afterEach, describe, expect, test } from "bun:test";

import { GET } from "../app/api/point/route";
import {
  clearPointCache,
  createPointService,
  CredsError,
  type EeLike,
  getPoint,
  type PointResult,
  setPointServiceForTest,
  TileNotFoundError,
  TileServiceError,
} from "./ee-point";

// Fake ee module that records every chained call so we can assert asset ids,
// band selection, point geometry and reduceRegion usage without credentials.
type Call = [string, ...unknown[]];

interface AssetSpec {
  bands?: string[]; // band ids on the asset (default: the dashed date band)
  props?: Record<string, unknown>; // asset properties
  error?: string; // error passed to the asset getInfo callback
  value?: number | null; // reduceRegion value at the point
  reduceError?: string; // error passed to the reduce getInfo callback
}

const FIELDS = ["tpi_slide", "tpi_flood", "r", "s", "t_slide", "t_flood"];
const STATIC = new Set(["t_slide", "t_flood"]);

const fieldOf = (assetId: string) =>
  FIELDS.find((f) => assetId.endsWith(`/${f}_series`) || assetId.endsWith(`/${f}`));

interface FakeOpts {
  specs?: Record<string, AssetSpec>; // keyed by field name
  values?: Record<string, number | null>; // per-field reduce values
  hang?: boolean; // getInfo never calls back — exercises withTimeout
}

function makeFakeEe(o: FakeOpts = {}) {
  const calls: Call[] = [];

  const specFor = (id: string): AssetSpec => {
    const field = fieldOf(id);
    const spec = field ? (o.specs?.[field] ?? {}) : {};
    return {
      // Series default to the dashed date band; statics to one single band.
      bands: spec.bands ?? (field && STATIC.has(field) ? ["constant"] : ["2024-05-01"]),
      props: spec.props,
      error: spec.error,
      value: spec.value !== undefined ? spec.value : (o.values?.[field ?? ""] ?? 1),
      reduceError: spec.reduceError,
    };
  };

  type EeImage = ReturnType<EeLike["Image"]>;
  const makeImage = (id: string): EeImage => {
    const spec = specFor(id);
    const img: Record<string, unknown> = {};
    img.select = (band: string) => (calls.push(["select", id, band]), img);
    img.reduceRegion = (params: unknown) => {
      calls.push(["reduceRegion", id, params]);
      return {
        getInfo: (cb: (d: unknown, e?: string) => void) => {
          if (o.hang) return;
          if (spec.reduceError) return cb(undefined, spec.reduceError);
          cb(spec.value === null ? {} : { value: spec.value });
        },
      };
    };
    img.getInfo = (cb: (d: unknown, e?: string) => void) => {
      if (o.hang) return;
      calls.push(["assetInfo", id]);
      if (spec.error) return cb(undefined, spec.error);
      cb({ bands: spec.bands!.map((b) => ({ id: b })), properties: spec.props ?? {} });
    };
    return img as unknown as EeImage;
  };

  const ee = {
    Image: (id: string) => (calls.push(["Image", id]), makeImage(id)),
    Geometry: {
      Point: (lon: number, lat: number) => (
        calls.push(["Point", lon, lat]), { lon, lat }
      ),
    },
    Reducer: { first: () => (calls.push(["Reducer.first"]), "first") },
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

const QUERY = { caseId: "rs-2024-05", date: "2024-05-01", lat: -29.7, lon: -51.1 } as const;
const NO_MANIFEST = () => null;

const makeService = (ee: EeLike, extra: Record<string, unknown> = {}) =>
  createPointService(ee, { assetRoot: "root", manifestAsset: NO_MANIFEST, ...extra });

describe("createPointService", () => {
  afterEach(() => clearPointCache());

  test("happy path: all six values, parallel roundtrips", async () => {
    const { ee, calls } = makeFakeEe({
      values: { tpi_slide: 0.7, tpi_flood: 0.2, r: 42, s: 0.9, t_slide: 12, t_flood: 3 },
    });
    const res = await makeService(ee).getPoint(QUERY);
    expect(res).toEqual({
      case: "rs-2024-05",
      canonical: "rs_2024",
      date: "2024-05-01",
      lat: -29.7,
      lon: -51.1,
      data_date: null,
      values: { tpi_slide: 0.7, tpi_flood: 0.2, r: 42, s: 0.9, t_slide: 12, t_flood: 3 },
    });
    // Six convention assets probed, each reduced once at the point.
    for (const f of FIELDS) {
      const id = STATIC.has(f) ? `root/rs_2024/${f}` : `root/rs_2024/${f}_series`;
      expect(calls).toContainEqual(["Image", id]);
      expect(calls).toContainEqual(["assetInfo", id]);
      expect(calls.filter((c) => c[0] === "reduceRegion" && c[1] === id)).toHaveLength(1);
    }
    expect(calls).toContainEqual(["Point", -51.1, -29.7]);
    expect(calls).toContainEqual(["Reducer.first"]);
    const reduce = calls.find((c) => c[0] === "reduceRegion");
    expect(reduce?.[2]).toMatchObject({ scale: 1000 });
  });

  test("alias case id resolves to the canonical asset path and echoes case", async () => {
    const { ee, calls } = makeFakeEe();
    const res = await makeService(ee).getPoint(QUERY);
    expect(res.case).toBe("rs-2024-05");
    expect(res.canonical).toBe("rs_2024");
    expect(calls).toContainEqual(["Image", "root/rs_2024/tpi_slide_series"]);
  });

  test("manifest-declared asset wins over the convention", async () => {
    const { ee, calls } = makeFakeEe();
    const svc = createPointService(ee, {
      assetRoot: "root",
      manifestAsset: (_c: string, _id: string, layer: string) =>
        layer === "tpi_slide" ? "custom/tpi_asset" : null,
    });
    await svc.getPoint(QUERY);
    expect(calls).toContainEqual(["Image", "custom/tpi_asset"]);
    expect(calls).not.toContainEqual(["Image", "root/rs_2024/tpi_slide_series"]);
  });

  test("partial missing assets -> nulls on those fields, still 200-shaped", async () => {
    const { ee } = makeFakeEe({
      specs: { r: { error: "Image not found" }, s: { error: "does not exist" } },
    });
    const res = await makeService(ee).getPoint(QUERY);
    expect(res.values.r).toBeNull();
    expect(res.values.s).toBeNull();
    expect(res.values.tpi_slide).toBe(1);
  });

  test("missing date band on an existing asset -> null, counts as answered", async () => {
    const { ee } = makeFakeEe({
      specs: { tpi_slide: { bands: ["2024-05-02", "2024-05-03"] } },
    });
    const res = await makeService(ee).getPoint(QUERY);
    expect(res.values.tpi_slide).toBeNull();
    expect(res.values.r).toBe(1); // other fields unaffected
  });

  test("compact YYYYMMDD band ids match the dashed query date", async () => {
    const { ee, calls } = makeFakeEe({
      specs: { tpi_slide: { bands: ["20240501"], value: 0.42 } },
    });
    const res = await makeService(ee).getPoint(QUERY);
    expect(res.values.tpi_slide).toBe(0.42);
    expect(calls).toContainEqual(["select", "root/rs_2024/tpi_slide_series", "20240501"]);
  });

  test("dYYYYMMDD window-end band is selected and sampled", async () => {
    const { ee, calls } = makeFakeEe({
      specs: { tpi_slide: { bands: ["d20240421", "d20240422"], value: 0.42 } },
    });
    const res = await makeService(ee).getPoint({ ...QUERY, date: "2024-04-22" });
    expect(res.values.tpi_slide).toBe(0.42);
    expect(calls).toContainEqual(["select", "root/rs_2024/tpi_slide_series", "d20240422"]);
    expect(calls.filter((c) => c[0] === "reduceRegion" && c[1] === "root/rs_2024/tpi_slide_series")).toHaveLength(1);
  });

  test("single-band static t_slide is used as-is (no select)", async () => {
    const { ee, calls } = makeFakeEe();
    const res = await makeService(ee).getPoint(QUERY);
    expect(res.values.t_slide).toBe(1);
    expect(calls.filter((c) => c[0] === "select" && c[1] === "root/rs_2024/t_slide")).toHaveLength(0);
    expect(calls.filter((c) => c[0] === "reduceRegion" && c[1] === "root/rs_2024/t_slide")).toHaveLength(1);
  });

  test("masked pixel -> null value", async () => {
    const { ee } = makeFakeEe({ specs: { s: { value: null } } });
    const res = await makeService(ee).getPoint(QUERY);
    expect(res.values.s).toBeNull();
  });

  test("every asset missing -> TileNotFoundError", async () => {
    const specs = Object.fromEntries(FIELDS.map((f) => [f, { error: "asset not found" }]));
    const { ee } = makeFakeEe({ specs });
    const err = await makeService(ee).getPoint(QUERY).then(
      () => null,
      (e) => e as Error
    );
    expect(err).toBeInstanceOf(TileNotFoundError);
  });

  test("a non-not-found EE failure -> TileServiceError (502 at the route)", async () => {
    const { ee } = makeFakeEe({ specs: { s: { error: "quota exceeded" } } });
    const err = await makeService(ee).getPoint(QUERY).then(
      () => null,
      (e) => e as Error
    );
    expect(err).toBeInstanceOf(TileServiceError);
  });

  test("hung ee roundtrip -> timeout TileServiceError (503 at the route)", async () => {
    const { ee } = makeFakeEe({ hang: true });
    const err = await makeService(ee, { timeoutMs: 5 })
      .getPoint(QUERY)
      .then(
        () => null,
        (e) => e as Error
      );
    expect(err).toBeInstanceOf(TileServiceError);
    expect(err?.message).toMatch(/^timeout/);
  });

  test("data_date comes from the first answered asset's properties", async () => {
    const { ee } = makeFakeEe({
      specs: {
        tpi_slide: { props: { data_date: "2024-04-30" } },
        r: { props: { updated_at: "2024-04-29" } },
      },
    });
    const res = await makeService(ee).getPoint(QUERY);
    expect(res.data_date).toBe("2024-04-30");
  });

  test("coordinate rounding dedupes the cache", async () => {
    const { ee, calls } = makeFakeEe();
    const svc = makeService(ee);
    await svc.getPoint({ ...QUERY, lat: 10.00001, lon: 20.00001 });
    const n = calls.length;
    const res = await svc.getPoint({ ...QUERY, lat: 10.00009, lon: 20.00009 });
    expect(calls.length).toBe(n); // same pixel -> no second EE roundtrip
    expect(res.lat).toBe(10);
    expect(res.lon).toBe(20);
  });

  test("not-found failures negative-cache for the short TTL", async () => {
    const specs = Object.fromEntries(FIELDS.map((f) => [f, { error: "asset not found" }]));
    const { ee, calls } = makeFakeEe({ specs });
    const svc = makeService(ee);
    await svc.getPoint(QUERY).catch(() => {});
    const n = calls.length;
    const err = await svc.getPoint(QUERY).then(
      () => null,
      (e) => e as Error
    );
    expect(err).toBeInstanceOf(TileNotFoundError);
    expect(calls.length).toBe(n);
  });
});

describe("getPoint (credentialed entry)", () => {
  afterEach(() => setPointServiceForTest(undefined));

  test("no service-account env -> CredsError", async () => {
    const err = await withoutEnv(SA_ENVS, () =>
      getPoint(QUERY).then(
        () => null,
        (e) => e as Error
      )
    );
    expect(err).toBeInstanceOf(CredsError);
  });
});

describe("GET /api/point", () => {
  const req = (qs: string) => new Request(`http://localhost/api/point?${qs}`);

  afterEach(() => setPointServiceForTest(undefined));

  // Drive the route past the creds check with a fake key + injected service.
  async function withService<T>(
    impl: (q: unknown) => Promise<PointResult>,
    fn: () => Promise<T>
  ): Promise<T> {
    const saved = process.env.GCP_SA_KEY;
    process.env.GCP_SA_KEY = "test-key";
    setPointServiceForTest({ getPoint: impl });
    try {
      return await fn();
    } finally {
      setPointServiceForTest(undefined);
      if (saved === undefined) delete process.env.GCP_SA_KEY;
      else process.env.GCP_SA_KEY = saved;
    }
  }

  const BODY: PointResult = {
    case: "rs-2024-05",
    canonical: "rs_2024",
    date: "2024-05-01",
    lat: -29.7,
    lon: -51.1,
    data_date: "2024-05-01",
    values: { tpi_slide: 0.7, tpi_flood: null, r: 42, s: 0.9, t_slide: 12, t_flood: null },
  };

  test("missing case -> 400 naming the param", async () => {
    const res = await GET(req("date=2024-05-01&lat=0&lon=0"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("case");
  });

  test("bad date -> 400 naming the param", async () => {
    const res = await GET(req("case=rs_2024&date=2024/05/01&lat=0&lon=0"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("date");
  });

  test("lat out of range -> 400 naming the param", async () => {
    const res = await GET(req("case=rs_2024&date=2024-05-01&lat=91&lon=0"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("lat");
  });

  test("non-finite lon -> 400 naming the param", async () => {
    const res = await GET(req("case=rs_2024&date=2024-05-01&lat=0&lon=abc"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("lon");
  });

  test("no service-account env -> 503 gee unavailable", async () => {
    const res = await withoutEnv(SA_ENVS, () =>
      GET(req("case=rs_2024&date=2024-05-01&lat=0&lon=0"))
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("gee unavailable");
  });

  test("timeout -> 503", async () => {
    const res = await withService(
      () => Promise.reject(new TileServiceError("timeout after 8000ms waiting for getInfo")),
      () => GET(req("case=rs_2024&date=2024-05-01&lat=0&lon=0"))
    );
    expect(res.status).toBe(503);
  });

  test("not found -> 404", async () => {
    const res = await withService(
      () => Promise.reject(new TileNotFoundError("no point asset answered for case rs_2024")),
      () => GET(req("case=rs_2024&date=2024-05-01&lat=0&lon=0"))
    );
    expect(res.status).toBe(404);
  });

  test("compute error -> 502", async () => {
    const res = await withService(
      () => Promise.reject(new TileServiceError("reduceRegion on x: quota exceeded")),
      () => GET(req("case=rs_2024&date=2024-05-01&lat=0&lon=0"))
    );
    expect(res.status).toBe(502);
  });

  test("success -> 200 with the point payload", async () => {
    const res = await withService(
      () => Promise.resolve(BODY),
      () => GET(req("case=rs-2024-05&date=2024-05-01&lat=-29.7&lon=-51.1"))
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(BODY);
  });

  test("compact date YYYYMMDD is normalized to dashed", async () => {
    let seen: unknown;
    const res = await withService(
      (q) => {
        seen = q;
        return Promise.resolve(BODY);
      },
      () => GET(req("case=rs_2024&date=20240501&lat=0&lon=0"))
    );
    expect(res.status).toBe(200);
    expect((seen as { date: string }).date).toBe("2024-05-01");
  });
});
