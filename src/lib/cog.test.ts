// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { afterEach, describe, expect, test } from "bun:test";

import { globals, writeArrayBuffer } from "geotiff";

import {
  cogLayerUrl,
  openCog,
  readCogPixel,
  readCogRST,
} from "./cog";

// bun-types isn't a dependency; declare the Bun.serve surface this test uses.
declare const Bun: {
  serve(options: {
    port?: number;
    fetch: (req: Request) => Response | Promise<Response>;
  }): { port: number; stop(closeActiveConnections?: boolean): void };
};

// --- fixture GeoTIFFs --------------------------------------------------------

// geotiff's writer has no fieldTagTypes entry for GDAL_METADATA (42112);
// register it as ASCII so writeArrayBuffer can emit band descriptions.
(globals.fieldTagTypes as Record<number, string>)[42112] = "ASCII";

const NODATA = -9999;
// 4x2 grid, 0.5° pixels, top-left corner at lon -50 / lat -29:
// lon in [-50, -48], lat in [-30, -29] (EPSG:4326).
const GEO = {
  width: 4,
  height: 2,
  ModelPixelScale: [0.5, 0.5, 0],
  ModelTiepoint: [0, 0, 0, -50, -29, 0],
  GeographicTypeGeoKey: 4326,
};

// Single band: row-major values 1..8 with pixel (2,0) = nodata.
const singleBand = writeArrayBuffer(
  new Float32Array([1, 2, NODATA, 4, 5, 6, 7, 8]),
  { ...GEO, GDAL_NODATA: String(NODATA) }
);

// 3 bands (one per day); pixel-interleaved, pixel p on band b = 10*b + p.
const banded = (withMetadata: boolean) => {
  const px = 8;
  const data = new Float32Array(px * 3);
  for (let p = 0; p < px; p++) {
    for (let b = 0; b < 3; b++) data[p * 3 + b] = 10 * b + p;
  }
  const gdal = `<GDALMetadata>${[0, 1, 2]
    .map(
      (i) =>
        `<Item name="DESCRIPTION" sample="${i}" role="description">2024050${
          i + 1
        }</Item>`
    )
    .join("")}</GDALMetadata>`;
  return writeArrayBuffer(data, {
    ...GEO,
    ...(withMetadata ? { GDAL_METADATA: gdal } : {}),
  });
};

// --- hermetic range server ---------------------------------------------------

const servers: { stop(): void }[] = [];
afterEach(() => {
  while (servers.length) servers.pop()!.stop();
});

// Minimal COG host: honors `Range: bytes=a-b` with 206 + Content-Range.
function serveCog(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get("range") ?? "");
      if (m) {
        const start = Number(m[1]);
        const end = m[2] ? Math.min(Number(m[2]), bytes.length - 1) : bytes.length - 1;
        return new Response(bytes.slice(start, end + 1), {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
            "Accept-Ranges": "bytes",
          },
        });
      }
      return new Response(bytes, { headers: { "Accept-Ranges": "bytes" } });
    },
  });
  servers.push(server);
  return `http://localhost:${server.port}/cog.tif`;
}

// --- tests -------------------------------------------------------------------

describe("readCogPixel", () => {
  test("reads the nearest pixel at a lon/lat", async () => {
    const url = serveCog(singleBand);
    expect(await readCogPixel(url, -49.75, -29.25)).toBe(1); // x=0,y=0
    expect(await readCogPixel(url, -48.3, -29.75)).toBe(8); // x=3,y=1
  });

  test("clamps to the edge pixel on the extent boundary", async () => {
    const url = serveCog(singleBand);
    expect(await readCogPixel(url, -48, -30)).toBe(8); // lon=e, lat=s
    expect(await readCogPixel(url, -50, -29)).toBe(1); // lon=w, lat=n
  });

  test("returns null outside the raster extent", async () => {
    const url = serveCog(singleBand);
    expect(await readCogPixel(url, -51, -29.5)).toBeNull();
    expect(await readCogPixel(url, -49, -28)).toBeNull();
    expect(await readCogPixel(url, -49, -31)).toBeNull();
  });

  test("returns null for nodata pixels", async () => {
    const url = serveCog(singleBand);
    expect(await readCogPixel(url, -48.75, -29.25)).toBeNull(); // x=2,y=0
  });

  test("returns null for an unreachable COG", async () => {
    expect(await readCogPixel("http://localhost:1/none.tif", -49, -29)).toBeNull();
  });

  test("date resolves the band via GDAL DESCRIPTION (multiband series)", async () => {
    const url = serveCog(banded(true));
    expect(await readCogPixel(url, -49.75, -29.25, { date: "2024-05-01" })).toBe(0);
    expect(await readCogPixel(url, -49.75, -29.25, { date: "2024-05-02" })).toBe(10);
    expect(await readCogPixel(url, -49.75, -29.25, { date: "20240503" })).toBe(20);
  });

  test("explicit band index wins over date", async () => {
    const url = serveCog(banded(true));
    expect(await readCogPixel(url, -49.25, -29.25, { band: 2 })).toBe(21);
    expect(
      await readCogPixel(url, -49.25, -29.25, { band: 2, date: "2024-05-01" })
    ).toBe(21);
  });

  test("out-of-range band index returns null", async () => {
    const url = serveCog(banded(true));
    expect(await readCogPixel(url, -49.75, -29.25, { band: 3 })).toBeNull();
  });

  test("bandOrder hint resolves the band when GDAL names are absent", async () => {
    const url = serveCog(banded(false));
    const bandOrder = ["20240501", "20240502", "20240503"];
    expect(
      await readCogPixel(url, -49.75, -29.25, { date: "2024-05-03", bandOrder })
    ).toBe(20);
  });

  test("unresolvable date on a multiband COG returns null", async () => {
    const url = serveCog(banded(true));
    expect(await readCogPixel(url, -49.75, -29.25, { date: "2024-05-10" })).toBeNull();
  });

  test("date on a single-band static layer still reads band 0", async () => {
    const url = serveCog(singleBand);
    expect(await readCogPixel(url, -49.75, -29.25, { date: "2024-05-02" })).toBe(1);
  });

  test("no opts reads band 0", async () => {
    const url = serveCog(banded(true));
    expect(await readCogPixel(url, -48.3, -29.75)).toBe(7); // band0 pixel 7
  });
});

describe("openCog", () => {
  test("caches the open promise by URL", async () => {
    const url = serveCog(singleBand);
    const first = openCog(url);
    expect(openCog(url)).toBe(first);
    await first; // open succeeds against the range server
    expect(openCog(url)).toBe(first);
  });
});

describe("readCogRST", () => {
  test("reads r/s/t layers in parallel, nulls when a layer is absent", async () => {
    const r = serveCog(banded(true));
    const t = serveCog(singleBand);
    const out = await readCogRST({ r, t }, -49.75, -29.25, { date: "2024-05-02" });
    expect(out).toEqual({ r: 10, s: null, t: 1 });
  });

  test("failed reads degrade to null rather than rejecting", async () => {
    const t = serveCog(singleBand);
    const out = await readCogRST(
      { r: "http://localhost:1/dead.tif", t },
      -49.75,
      -29.25
    );
    expect(out).toEqual({ r: null, s: null, t: 1 });
  });
});

describe("cogLayerUrl", () => {
  test("delegates to resolveAsset semantics", () => {
    expect(cogLayerUrl("cog/r.tif", "https://data.example.com", "ev-1")).toBe(
      "https://data.example.com/ev-1/cog/r.tif"
    );
    expect(
      cogLayerUrl("gs://bucket/ev-1/cog/r.tif", "https://x", "ev-1")
    ).toBe("https://storage.googleapis.com/bucket/ev-1/cog/r.tif");
    expect(cogLayerUrl("https://cdn/x.tif", "https://x", "ev-1")).toBe(
      "https://cdn/x.tif"
    );
    expect(cogLayerUrl(undefined, "https://x", "ev-1")).toBeUndefined();
  });
});
