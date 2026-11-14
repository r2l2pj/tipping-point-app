// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { afterEach, describe, expect, test } from "bun:test";

import { GET } from "../app/api/tiles/route";
import {
  clearTileCache,
  createTileService,
  CredsError,
  getTiles,
  TileNotFoundError,
  type EeClient,
} from "./ee-tiles";

// Fake ee module that records every chained call so we can assert the asset
// id, band selection and visualize params without credentials.
type Call = [string, ...unknown[]];

function makeFakeEe(opts: { bands?: string[]; map?: Record<string, unknown> } = {}) {
  const calls: Call[] = [];
  const bands = opts.bands ?? ["2024-05-01"];
  const map = opts.map ?? {
    mapid: "fake-mapid",
    url_format: "https://earthengine.example/{z}/{x}/{y}",
  };
  const image = (id: string) => {
    calls.push(["Image", id]);
    const img = {
      bandNames: () => {
        calls.push(["bandNames"]);
        return { getInfo: (cb: (d: unknown, e?: string) => void) => cb(bands) };
      },
      select: (band: string) => {
        calls.push(["select", band]);
        return img;
      },
      gt: (v: number) => {
        calls.push(["gt", v]);
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
      visualize: (params: unknown) => {
        calls.push(["visualize", params]);
        return img;
      },
      getMapId: (...args: unknown[]) => {
        calls.push(["getMapId"]);
        const cb = args.find((a) => typeof a === "function") as (
          id?: unknown,
          err?: string
        ) => void;
        cb(map);
      },
    };
    return img;
  };
  return { ee: { Image: image } as unknown as EeClient, calls };
}

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

const QUERY = { layer: "tpi_slide", caseId: "rs-2024-05", date: "2024-05-01" } as const;

describe("createTileService", () => {
  afterEach(() => clearTileCache());

  test("asset id uses the canonical case id and selects the date band", async () => {
    const { ee, calls } = makeFakeEe();
    const svc = createTileService(ee, { assetRoot: "root" });
    await svc.getTiles(QUERY);
    expect(calls[0]).toEqual(["Image", "root/rs_2024_tpi_slide_series"]);
    expect(calls).toContainEqual(["select", "2024-05-01"]);
  });

  test("wa hyphen id canonicalizes; flood layer gets its own asset", async () => {
    const { ee, calls } = makeFakeEe();
    const svc = createTileService(ee, { assetRoot: "root" });
    await svc.getTiles({ layer: "tpi_flood", caseId: "wa-2025-12", date: "2024-05-01" });
    expect(calls[0]).toEqual(["Image", "root/wa_2025_tpi_flood_series"]);
  });

  test("bins into 4 classes, masks Low, paints moderate→critical", async () => {
    const { ee, calls } = makeFakeEe();
    const svc = createTileService(ee, { assetRoot: "root" });
    await svc.getTiles(QUERY);
    expect(calls).toContainEqual(["gt", 0.2]);
    expect(calls).toContainEqual(["gt", 0.4]);
    expect(calls).toContainEqual(["gt", 0.6]);
    expect(calls).toContainEqual(["updateMask"]);
    const vis = calls.find((c) => c[0] === "visualize");
    expect(vis?.[1]).toEqual({
      min: 1,
      max: 3,
      palette: ["#FECC5C", "#FD8D3C", "#BD0026"],
    });
  });

  test("tiles mapped from the mapid url_format; expires_at = issued + 2h", async () => {
    const { ee } = makeFakeEe();
    const svc = createTileService(ee, { assetRoot: "root", now: () => 1000 });
    const res = await svc.getTiles(QUERY);
    expect(res.tiles).toEqual(["https://earthengine.example/{z}/{x}/{y}"]);
    expect(res.expires_at).toBe(new Date(1000 + 2 * 3600e3).toISOString());
  });

  test("cache hit does not touch ee again", async () => {
    const { ee, calls } = makeFakeEe();
    const svc = createTileService(ee, { assetRoot: "root" });
    await svc.getTiles(QUERY);
    const n = calls.length;
    const res = await svc.getTiles(QUERY);
    expect(calls.length).toBe(n);
    expect(res.tiles).toEqual(["https://earthengine.example/{z}/{x}/{y}"]);
  });

  test("expired entry refetches", async () => {
    const { ee, calls } = makeFakeEe();
    let now = 1_000_000;
    const svc = createTileService(ee, { assetRoot: "root", now: () => now });
    await svc.getTiles(QUERY);
    const n = calls.length;
    now += 2 * 3600e3; // past TTL minus refresh skew
    await svc.getTiles(QUERY);
    expect(calls.length).toBeGreaterThan(n);
    expect(calls.filter((c) => c[0] === "Image")).toHaveLength(2);
  });

  test("missing date band -> TileNotFoundError", async () => {
    const { ee } = makeFakeEe({ bands: ["2024-05-02"] });
    const svc = createTileService(ee, { assetRoot: "root" });
    const err = await svc.getTiles(QUERY).then(
      () => null,
      (e) => e as Error
    );
    expect(err).toBeInstanceOf(TileNotFoundError);
    expect(err?.message).toContain("2024-05-01");
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

  test("bad layer -> 400 naming the param", async () => {
    const res = await GET(req("layer=nope&case=rs_2024&date=2024-05-01"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("layer");
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
});
