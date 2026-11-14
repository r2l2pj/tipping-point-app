// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { afterEach, describe, expect, mock, test } from "bun:test";

import { GET } from "../app/api/tiles/route";
import {
  clearTileCache,
  createTileService,
  CredsError,
  type EeClient,
  getTiles,
  TILE_LAYERS,
  TileNotFoundError,
  type TileServiceOptions,
} from "./ee-tiles";
import { TileServiceError } from "./ee-shared";

// Stub the credential/init module so the credentialed path (route → getTiles)
// runs against a fake ee. credentialEnv mirrors the real env check;
// earthEngine resolves whatever fake the test installed on globalThis.
// mock.module is hoisted above imports, so factories may only touch globals.
mock.module("@/lib/ee", () => ({
  credentialEnv: () =>
    process.env.GCP_SA_KEY || process.env.GEE_SERVICE_ACCOUNT_KEY
      ? "GCP_SA_KEY"
      : null,
  earthEngine: () =>
    Promise.resolve((globalThis as { __fakeEe?: unknown }).__fakeEe),
}));
mock.module("./ee", () => ({
  credentialEnv: () =>
    process.env.GCP_SA_KEY || process.env.GEE_SERVICE_ACCOUNT_KEY
      ? "GCP_SA_KEY"
      : null,
  earthEngine: () =>
    Promise.resolve((globalThis as { __fakeEe?: unknown }).__fakeEe),
}));

const installFakeEe = (ee: EeClient) => {
  (globalThis as Record<string, unknown>).__fakeEe = ee;
};

afterEach(() => clearTileCache());

// Fake ee module that records every chained call so we can assert the asset
// id, band selection and visualize params without credentials.
type Call = [string, ...unknown[]];

interface FakeOpts {
  bands?: string[]; // band ids reported by getInfo
  props?: Record<string, unknown>; // asset properties reported by getInfo
  map?: Record<string, unknown>; // getMapId result
  infoErr?: string; // getInfo error
  mapErr?: string; // getMapId error
  hang?: "getInfo" | "getMapId"; // callback never fires → timeout
  missing?: string[]; // asset ids whose getInfo reports not-found
}

function makeFakeEe(opts: FakeOpts = {}) {
  const calls: Call[] = [];
  const bands = opts.bands ?? ["2024-05-01"];
  const info = { bands: bands.map((id) => ({ id })), properties: opts.props };
  const map = opts.map ?? {
    mapid: "fake-mapid",
    url_format: "https://earthengine.example/{z}/{x}/{y}",
  };
  const image = (id: string) => {
    calls.push(["Image", id]);
    const img = {
      getInfo: (cb: (d: unknown, e?: string) => void) => {
        calls.push(["getInfo"]);
        if (opts.hang === "getInfo") return;
        if (opts.missing?.includes(id)) cb(undefined, `${id} does not exist`);
        else if (opts.infoErr) cb(undefined, opts.infoErr);
        else cb(info);
      },
      select: (band: string) => {
        calls.push(["select", band]);
        return img;
      },
      gt: (v: number) => {
        calls.push(["gt", v]);
        return img;
      },
      gte: (v: number) => {
        calls.push(["gte", v]);
        return img;
      },
      add: () => {
        calls.push(["add"]);
        return img;
      },
      updateMask: () => {
        calls.push(["updateMask"]);
        return img;
      },
      selfMask: () => {
        calls.push(["selfMask"]);
        return img;
      },
      visualize: (params: unknown) => {
        calls.push(["visualize", params]);
        return img;
      },
      getMapId: (params: unknown, cb?: (id?: unknown, err?: string) => void) => {
        calls.push(["getMapId", params]);
        if (opts.hang === "getMapId" || !cb) return;
        if (opts.mapErr) cb(undefined, opts.mapErr);
        else cb(map);
      },
    };
    return img;
  };
  return { ee: { Image: image } as unknown as EeClient, calls };
}

// Service with the manifest seam pinned to "no explicit asset" so tests hit
// the <root>/<canonical>/<layer>_series convention unless they say otherwise.
const svc = (ee: EeClient, opts: TileServiceOptions = {}) =>
  createTileService(ee, {
    assetRoot: "root",
    manifestAsset: async () => null,
    ...opts,
  });

const SA_ENVS = ["GCP_SA_KEY", "GEE_SERVICE_ACCOUNT_KEY"] as const;

// Run fn with both credential envs unset (they could leak in from .env).
async function withoutCreds<T>(fn: () => T | Promise<T>): Promise<T> {
  const saved = SA_ENVS.map((k) => [k, process.env[k]] as const);
  for (const k of SA_ENVS) delete process.env[k];
  try {
    return await fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const QUERY = {
  layer: "tpi_slide",
  caseId: "rs-2024-05",
  date: "2024-05-01",
} as const;

describe("createTileService", () => {
  test("manifest asset wins over the _series convention", async () => {
    const { ee, calls } = makeFakeEe();
    const seen: unknown[][] = [];
    const svcExplicit = createTileService(ee, {
      assetRoot: "root",
      manifestAsset: async (...args) => {
        seen.push(args);
        return "projects/x/assets/explicit";
      },
    });
    await svcExplicit.getTiles(QUERY);
    expect(seen[0]).toEqual(["rs-2024-05", "tpi_slide", "2024-05-01"]);
    expect(calls[0]).toEqual(["Image", "projects/x/assets/explicit"]);
  });

  test("manifest asset wins over both convention candidates", async () => {
    const { ee, calls } = makeFakeEe();
    await createTileService(ee, {
      assetRoot: "root",
      manifestAsset: async () => "projects/x/assets/explicit",
    }).getTiles(QUERY);
    expect(calls.filter((c) => c[0] === "Image")).toEqual([
      ["Image", "projects/x/assets/explicit"],
    ]);
  });

  test("a missing manifest asset is a 404, not a convention fallback", async () => {
    const { ee, calls } = makeFakeEe({
      missing: ["projects/x/assets/explicit"],
    });
    const err = await createTileService(ee, {
      assetRoot: "root",
      manifestAsset: async () => "projects/x/assets/explicit",
    })
      .getTiles(QUERY)
      .then(
        () => null,
        (e) => e as Error
      );
    expect(err).toBeInstanceOf(TileNotFoundError);
    expect(calls.filter((c) => c[0] === "Image")).toHaveLength(1);
  });

  test("bare <layer> is the fallback when <layer>_series is absent", async () => {
    const { ee, calls } = makeFakeEe({
      missing: ["root/rs_2024/tpi_slide_series"],
    });
    const res = await svc(ee).getTiles(QUERY);
    expect(calls.filter((c) => c[0] === "Image")).toEqual([
      ["Image", "root/rs_2024/tpi_slide_series"],
      ["Image", "root/rs_2024/tpi_slide"],
    ]);
    expect(res.tiles).toHaveLength(1);
  });

  test("non-not-found error on <layer>_series does not fall through", async () => {
    const { ee, calls } = makeFakeEe({ infoErr: "internal compute error" });
    const err = await svc(ee)
      .getTiles(QUERY)
      .then(
        () => null,
        (e) => e as Error
      );
    expect(err).toBeInstanceOf(TileServiceError);
    expect(calls.filter((c) => c[0] === "Image")).toHaveLength(1);
  });

  test("convention fallback: <root>/<canonical>/<layer>_series", async () => {
    const { ee, calls } = makeFakeEe();
    await svc(ee).getTiles(QUERY);
    expect(calls[0]).toEqual(["Image", "root/rs_2024/tpi_slide_series"]);
  });

  test("hyphen alias canonicalizes; flood layer gets its own asset", async () => {
    const { ee, calls } = makeFakeEe();
    await svc(ee).getTiles({
      layer: "tpi_flood",
      caseId: "wa-2025-12",
      date: "2024-05-01",
    });
    expect(calls[0]).toEqual(["Image", "root/wa_2025/tpi_flood_series"]);
  });

  test("case=now resolves through a manifest asset (single-band _dN)", async () => {
    const { ee, calls } = makeFakeEe({ bands: ["tpi_d1"] });
    const svcNow = createTileService(ee, {
      assetRoot: "root",
      manifestAsset: async () => "root/now/tpi_slide_d1",
    });
    const res = await svcNow.getTiles({
      layer: "tpi_slide",
      caseId: "now",
      date: "2026-11-14",
    });
    expect(calls[0]).toEqual(["Image", "root/now/tpi_slide_d1"]);
    expect(calls.some((c) => c[0] === "select")).toBe(false);
    expect(res.case).toBe("now");
  });

  test("case=now without a manifest asset -> TileNotFoundError before ee", async () => {
    const { ee, calls } = makeFakeEe();
    const err = await svc(ee)
      .getTiles({ layer: "tpi_slide", caseId: "now", date: "2026-11-14" })
      .then(
        () => null,
        (e) => e as Error
      );
    expect(err).toBeInstanceOf(TileNotFoundError);
    expect(calls).toHaveLength(0);
  });

  test("date band selects the band in either form (YYYY-MM-DD, YYYYMMDD)", async () => {
    const dashed = makeFakeEe({ bands: ["2024-05-01", "2024-05-02"] });
    await svc(dashed.ee).getTiles(QUERY);
    expect(dashed.calls).toContainEqual(["select", "2024-05-01"]);
    clearTileCache(); // same key — don't let the first call serve the second
    const compact = makeFakeEe({ bands: ["20240501", "20240502"] });
    await svc(compact.ee).getTiles(QUERY);
    expect(compact.calls).toContainEqual(["select", "20240501"]);
  });

  test("dYYYYMMDD window-end band resolves through getMapId", async () => {
    const { ee, calls } = makeFakeEe({ bands: ["d20240421", "d20240422"] });
    const res = await svc(ee).getTiles({ ...QUERY, date: "2024-04-22" });
    expect(calls).toContainEqual(["select", "d20240422"]);
    expect(calls).toContainEqual(["getMapId", {}]);
    expect(res.tiles).toHaveLength(1);
  });

  test("single-band asset is used as-is (no select)", async () => {
    const { ee, calls } = makeFakeEe({ bands: ["tpi_slide_d1"] });
    const res = await svc(ee).getTiles(QUERY);
    expect(calls.some((c) => c[0] === "select")).toBe(false);
    expect(res.tiles[0]).toContain("{z}");
  });

  test("missing date band on a multiband asset -> TileNotFoundError", async () => {
    const { ee } = makeFakeEe({ bands: ["2024-05-02", "2024-05-03"] });
    const err = await svc(ee)
      .getTiles(QUERY)
      .then(
        () => null,
        (e) => e as Error
      );
    expect(err).toBeInstanceOf(TileNotFoundError);
    expect(err?.message).toContain("2024-05-01");
  });

  test("classes layers bin at class mins, mask Low, paint moderate→critical", async () => {
    const { ee, calls } = makeFakeEe();
    await svc(ee).getTiles(QUERY);
    expect(calls).toContainEqual(["gte", 0.2]);
    expect(calls).toContainEqual(["gte", 0.4]);
    expect(calls).toContainEqual(["gte", 0.6]);
    expect(calls).toContainEqual(["gt", 0]); // mask keeps class 0 transparent
    expect(calls).toContainEqual(["updateMask"]);
    const vis = calls.find((c) => c[0] === "visualize");
    expect(vis?.[1]).toEqual({
      min: 1,
      max: 3,
      palette: ["#FECC5C", "#FD8D3C", "#BD0026"],
    });
  });

  test("t_ml shares the class binning", async () => {
    const { ee, calls } = makeFakeEe();
    await svc(ee).getTiles({ ...QUERY, layer: "t_ml" });
    expect(calls.find((c) => c[0] === "visualize")?.[1]).toEqual({
      min: 1,
      max: 3,
      palette: ["#FECC5C", "#FD8D3C", "#BD0026"],
    });
  });

  test("ramp layers mask below min and paint the min→max ramp", async () => {
    const { ee, calls } = makeFakeEe();
    await svc(ee).getTiles({ ...QUERY, layer: "nisar_pre" });
    expect(calls).toContainEqual(["gte", -25]);
    expect(calls).toContainEqual(["updateMask"]);
    expect(calls.find((c) => c[0] === "visualize")?.[1]).toEqual({
      min: -25,
      max: -5,
      palette: ["#000000", "#FFFFFF"],
    });
  });

  test("mask layers selfMask into a single color", async () => {
    for (const [layer, color] of [
      ["flood_confirmed", "#2166AC"],
      ["permanent_water", "#9ECAE1"],
      ["landslide_candidates", "#7B3294"],
    ] as const) {
      const { ee, calls } = makeFakeEe();
      await svc(ee).getTiles({ ...QUERY, layer });
      expect(calls).toContainEqual(["selfMask"]);
      expect(calls.find((c) => c[0] === "visualize")?.[1]).toEqual({
        palette: [color],
      });
    }
  });

  test("categorical opera_validation masks 0 and paints 1–4", async () => {
    const { ee, calls } = makeFakeEe();
    await svc(ee).getTiles({ ...QUERY, layer: "opera_validation" });
    expect(calls).toContainEqual(["gt", 0]);
    expect(calls).toContainEqual(["updateMask"]);
    expect(calls.find((c) => c[0] === "visualize")?.[1]).toEqual({
      min: 1,
      max: 4,
      palette: ["#2166AC", "#92C5DE", "#F4A582", "#BDBDBD"],
    });
  });

  test("every registry layer produces tiles off the convention asset", async () => {
    for (const layer of TILE_LAYERS) {
      const { ee, calls } = makeFakeEe();
      const res = await svc(ee).getTiles({ ...QUERY, layer });
      expect(calls[0]).toEqual(["Image", `root/rs_2024/${layer}_series`]);
      expect(res.tiles).toHaveLength(1);
      expect(res.layer).toBe(layer);
    }
  });

  test("response echoes layer/case/date; data_date from asset properties", async () => {
    const { ee } = makeFakeEe({ props: { data_date: "2024-04-30" } });
    const res = await svc(ee, { now: () => 1000 }).getTiles(QUERY);
    expect(res).toEqual({
      tiles: ["https://earthengine.example/{z}/{x}/{y}"],
      expires_at: new Date(1000 + 2 * 3600e3).toISOString(),
      data_date: "2024-04-30",
      layer: "tpi_slide",
      case: "rs-2024-05",
      date: "2024-05-01",
    });
  });

  test("data_date falls back to updated_at, else null", async () => {
    const { ee } = makeFakeEe({
      props: { updated_at: "2024-05-02T00:00:00Z" },
    });
    expect((await svc(ee).getTiles(QUERY)).data_date).toBe(
      "2024-05-02T00:00:00Z"
    );
    clearTileCache(); // same key — don't serve the first call's data_date
    const bare = makeFakeEe();
    expect((await svc(bare.ee).getTiles(QUERY)).data_date).toBeNull();
  });

  test("data_date is cached with the tiles", async () => {
    const { ee, calls } = makeFakeEe({ props: { data_date: "2024-04-30" } });
    const service = svc(ee);
    await service.getTiles(QUERY);
    const n = calls.length;
    const res = await service.getTiles(QUERY);
    expect(calls.length).toBe(n);
    expect(res.data_date).toBe("2024-04-30");
  });

  test("cache hit does not touch ee again", async () => {
    const { ee, calls } = makeFakeEe();
    const service = svc(ee);
    await service.getTiles(QUERY);
    const n = calls.length;
    const res = await service.getTiles(QUERY);
    expect(calls.length).toBe(n);
    expect(res.tiles).toEqual(["https://earthengine.example/{z}/{x}/{y}"]);
  });

  test("expired entry refetches", async () => {
    const { ee, calls } = makeFakeEe();
    let now = 1_000_000;
    const service = svc(ee, { now: () => now });
    await service.getTiles(QUERY);
    const n = calls.length;
    now += 2 * 3600e3; // past TTL minus refresh skew
    await service.getTiles(QUERY);
    expect(calls.length).toBeGreaterThan(n);
    expect(calls.filter((c) => c[0] === "Image")).toHaveLength(2);
  });

  test("ee 'not found' info error -> TileNotFoundError; other -> TileServiceError", async () => {
    const notFound = makeFakeEe({ infoErr: "asset projects/x does not exist" });
    const e1 = await svc(notFound.ee)
      .getTiles(QUERY)
      .then(
        () => null,
        (e) => e as Error
      );
    expect(e1).toBeInstanceOf(TileNotFoundError);
    const boom = makeFakeEe({ infoErr: "internal compute error" });
    const e2 = await svc(boom.ee)
      .getTiles(QUERY)
      .then(
        () => null,
        (e) => e as Error
      );
    expect(e2).toBeInstanceOf(TileServiceError);
  });

  test("getMapId receives explicit params before its callback", async () => {
    const { ee, calls } = makeFakeEe();
    const res = await svc(ee, { timeoutMs: 20 }).getTiles(QUERY);
    expect(calls).toContainEqual(["getMapId", {}]);
    expect(res.tiles).toEqual(["https://earthengine.example/{z}/{x}/{y}"]);
  });

  test("getMapId failure -> TileServiceError", async () => {
    const bad = makeFakeEe({ mapErr: "compute failed" });
    const e1 = await svc(bad.ee)
      .getTiles(QUERY)
      .then(
        () => null,
        (e) => e as Error
      );
    expect(e1).toBeInstanceOf(TileServiceError);
    const noUrl = makeFakeEe({ map: { mapid: "x" } });
    const e2 = await svc(noUrl.ee)
      .getTiles(QUERY)
      .then(
        () => null,
        (e) => e as Error
      );
    expect(e2).toBeInstanceOf(TileServiceError);
  });

  test("EE roundtrip timeout -> TileServiceError starting with 'timeout'", async () => {
    const { ee } = makeFakeEe({ hang: "getInfo" });
    const err = await svc(ee, { timeoutMs: 20 })
      .getTiles(QUERY)
      .then(
        () => null,
        (e) => e as Error
      );
    expect(err).toBeInstanceOf(TileServiceError);
    expect(err?.message.startsWith("timeout")).toBe(true);
  });
});

describe("getTiles (credentialed entry)", () => {
  test("no service-account env -> CredsError", async () => {
    const err = await withoutCreds(() =>
      getTiles(QUERY).then(
        () => null,
        (e) => e as Error
      )
    );
    expect(err).toBeInstanceOf(CredsError);
  });
});

describe("GET /api/tiles", () => {
  const req = (qs: string) => new Request(`http://localhost/api/tiles?${qs}`);

  // Pretend creds exist — ee itself is stubbed, so "{}" never leaves the
  // process; it only makes credentialEnv() truthy.
  async function withCreds<T>(fn: () => Promise<T>): Promise<T> {
    const saved = process.env.GCP_SA_KEY;
    process.env.GCP_SA_KEY = "{}";
    try {
      return await fn();
    } finally {
      if (saved === undefined) delete process.env.GCP_SA_KEY;
      else process.env.GCP_SA_KEY = saved;
    }
  }

  test("bad layer -> 400 naming the param and listing ids", async () => {
    const res = await GET(req("layer=nope&case=rs_2024&date=2024-05-01"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("layer");
    expect(body.error).toContain("opera_validation");
  });

  test("missing case -> 400 naming the param", async () => {
    const res = await GET(req("layer=tpi_slide&date=2024-05-01"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("case");
  });

  test("bad date -> 400 naming the param", async () => {
    const res = await GET(req("layer=tpi_slide&case=rs_2024&date=2024/05/01"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("date");
  });

  test("no service-account env -> 503 gee unavailable", async () => {
    const res = await withoutCreds(() =>
      GET(req("layer=tpi_slide&case=rs_2024&date=2024-05-01"))
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("gee unavailable");
  });

  test("200 echoes layer/case/date and carries data_date", async () => {
    const { ee } = makeFakeEe({ props: { data_date: "2024-05-02" } });
    installFakeEe(ee);
    const res = await withCreds(() =>
      GET(req("layer=tpi_slide&case=rs-2024-05&date=2024-05-01"))
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tiles).toEqual(["https://earthengine.example/{z}/{x}/{y}"]);
    expect(body.data_date).toBe("2024-05-02");
    expect(body.layer).toBe("tpi_slide");
    expect(body.case).toBe("rs-2024-05");
    expect(body.date).toBe("2024-05-01");
    expect(typeof body.expires_at).toBe("string");
  });

  test("missing date band -> 404", async () => {
    const { ee } = makeFakeEe({ bands: ["2024-05-09", "2024-05-10"] });
    installFakeEe(ee);
    const res = await withCreds(() =>
      GET(req("layer=tpi_slide&case=rs-2024-05&date=2024-05-01"))
    );
    expect(res.status).toBe(404);
  });

  test("case=now with no manifest asset -> 404", async () => {
    const { ee } = makeFakeEe();
    installFakeEe(ee);
    const res = await withCreds(() =>
      GET(req("layer=tpi_slide&case=now&date=2026-11-14"))
    );
    expect(res.status).toBe(404);
  });

  test("ee compute failure -> 502", async () => {
    const { ee } = makeFakeEe({ infoErr: "internal compute error" });
    installFakeEe(ee);
    const res = await withCreds(() =>
      GET(req("layer=tpi_slide&case=rs-2024-05&date=2024-05-01"))
    );
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("gee tiles failed");
  });

  test("ee timeout -> 503 gee unavailable", async () => {
    const { ee } = makeFakeEe({ hang: "getInfo" });
    installFakeEe(ee);
    const saved = process.env.GEE_TIMEOUT_MS;
    process.env.GEE_TIMEOUT_MS = "20";
    try {
      const res = await withCreds(() =>
        GET(req("layer=tpi_slide&case=rs-2024-05&date=2024-05-01"))
      );
      expect(res.status).toBe(503);
      expect((await res.json()).error).toBe("gee unavailable");
    } finally {
      if (saved === undefined) delete process.env.GEE_TIMEOUT_MS;
      else process.env.GEE_TIMEOUT_MS = saved;
    }
  });
});
