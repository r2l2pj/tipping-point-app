// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a dependency.
import { describe, expect, test } from "bun:test";
import { earthEngine } from "./ee";
import { imageInfo, withTimeout } from "./ee-shared";
import { createTileService, TileNotFoundError } from "./ee-tiles";
import {
  createLayerService,
  type EeLike as LayersEeLike,
  LayersUnavailableError,
} from "./ee-layers";
import {
  createNumbersService,
  type EeLike as NumbersEeLike,
  NumbersNotFoundError,
} from "./ee-numbers";
import {
  createMetricsService,
  type EeLike as MetricsEeLike,
  MetricsNotFoundError,
} from "./ee-metrics";
import { canonicalCaseId } from "./contract";

// Live GEE smoke: skipped (and reported as skipped) unless real creds exist.
// Never print env values or key content — only names.
const HAS_CREDS =
  Boolean(process.env.GCP_SA_KEY || process.env.GEE_SERVICE_ACCOUNT_KEY) &&
  Boolean(process.env.GEE_PROJECT);
const itLive = test.skipIf(!HAS_CREDS);

const INIT_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = 45_000;
const CASE = "rs_2024";
const DATE = "2024-05-01";

// Structural typing for the ImageCollection chain used by the IMERG probe;
// src/types/earthengine.d.ts only declares ee.Image.
type EeImageCollectionFactory = (id: string) => {
  limit(n: number): {
    first(): { getInfo(cb: (d: unknown, e?: string) => void): void };
  };
};

// Memoized so a hung/failed init costs one 30 s wait, not one per test.
let init: ReturnType<typeof earthEngine> | undefined;
const client = () =>
  (init ??= withTimeout(earthEngine(), INIT_TIMEOUT_MS, "earthEngine() init"));

// Runs `fn`; returns "result" on success, "not-found" when it throws one of
// the tolerated classes, and rethrows anything else so outages fail loudly.
async function tolerant<T>(
  fn: () => Promise<T>,
  notFound: (new (...args: never[]) => Error)[]
): Promise<{ branch: "result"; value: T } | { branch: "not-found"; error: Error }> {
  try {
    return { branch: "result", value: await fn() };
  } catch (e) {
    if (notFound.some((cls) => e instanceof cls))
      return { branch: "not-found", error: e as Error };
    throw e;
  }
}

describe("gee smoke (live)", () => {
  if (!HAS_CREDS)
    console.log(
      "gee smoke: skipped — set GCP_SA_KEY (or GEE_SERVICE_ACCOUNT_KEY) and GEE_PROJECT"
    );

  for (const probe of [
    { asset: "NASA/NASADEM_HGT/001", kind: "image" as const },
    { asset: "NASA/GPM_L3/IMERG_V07", kind: "collection" as const },
  ]) {
    itLive(
      `reachability: ${probe.asset} getInfo resolves`,
      async () => {
        const ee = await client();
        const info = await withTimeout(
          imageInfo(
            probe.kind === "image"
              ? ee.Image(probe.asset)
              : (ee.ImageCollection as EeImageCollectionFactory)(probe.asset)
                  .limit(1)
                  .first(),
            `getInfo on ${probe.asset}`
          ),
          INIT_TIMEOUT_MS,
          `getInfo on ${probe.asset}`
        );
        expect(typeof info).toBe("object");
        console.log(
          `gee smoke reachability ${probe.asset}: ok (bands=${info.bands?.length ?? 0})`
        );
      },
      TEST_TIMEOUT_MS
    );
  }

  itLive(
    "tiles: tpi_slide url template or TileNotFoundError",
    async () => {
      const ee = await client();
      const r = await tolerant(
        () =>
          createTileService(ee).getTiles({
            layer: "tpi_slide",
            caseId: CASE,
            date: DATE,
          }),
        [TileNotFoundError]
      );
      if (r.branch === "result") {
        expect(r.value.tiles.length).toBe(1);
        expect(r.value.tiles[0]).toContain("{z}/{x}/{y}");
        expect("data_date" in r.value).toBe(true);
      }
      console.log(
        `gee smoke tiles: ${r.branch}${r.branch === "result" ? ` (tiles=${r.value.tiles.length})` : ""}`
      );
    },
    TEST_TIMEOUT_MS
  );

  itLive(
    "layers: probe returns metas or a not-found/unavailable error",
    async () => {
      const ee = await client();
      const r = await tolerant(
        () =>
          createLayerService(ee as unknown as LayersEeLike, {
            manifest: null,
          }).probe(canonicalCaseId(CASE)),
        [LayersUnavailableError, TileNotFoundError]
      );
      if (r.branch === "result") {
        expect(Array.isArray(r.value)).toBe(true);
        for (const meta of r.value) {
          expect(typeof meta.id).toBe("string");
          expect(Array.isArray(meta.dates)).toBe(true);
        }
      }
      console.log(
        `gee smoke layers: ${r.branch}${r.branch === "result" ? ` (ids=${r.value.map((m) => m.id).join(",") || "none"})` : ""}`
      );
    },
    TEST_TIMEOUT_MS
  );

  itLive(
    "numbers: numeric result or NumbersNotFoundError",
    async () => {
      const ee = await client();
      const r = await tolerant(
        () =>
          createNumbersService(ee as unknown as NumbersEeLike).getNumbers({
            caseId: CASE,
            date: DATE,
          }),
        [NumbersNotFoundError]
      );
      if (r.branch === "result") {
        const nums = (
          ["km2_critical", "people_exposed", "flooded_km2", "people_flooded"] as const
        ).filter((k) => r.value[k] !== undefined);
        expect(nums.length).toBeGreaterThan(0);
        for (const k of nums) expect(Number.isFinite(r.value[k])).toBe(true);
      }
      console.log(
        `gee smoke numbers: ${r.branch}${r.branch === "result" ? ` (source=${r.value.source})` : ""}`
      );
    },
    TEST_TIMEOUT_MS
  );

  itLive(
    "metrics: metrics object or MetricsNotFoundError",
    async () => {
      const ee = await client();
      const r = await tolerant(
        () =>
          createMetricsService(ee as unknown as MetricsEeLike).getMetrics({
            caseId: CASE,
          }),
        [MetricsNotFoundError]
      );
      if (r.branch === "result") {
        expect(typeof r.value.metrics).toBe("object");
        expect(Array.isArray(r.value.sources)).toBe(true);
        expect(r.value.sources.length).toBeGreaterThan(0);
        if (r.value.sources.includes("gee")) {
          expect(typeof r.value.data_date).toBe("string");
        } else {
          expect(r.value.data_date === null || typeof r.value.data_date === "string").toBe(true);
        }
      }
      console.log(
        `gee smoke metrics: ${r.branch}${r.branch === "result" ? ` (keys=${Object.keys(r.value.metrics).length}, sources=${r.value.sources.join(",")})` : ""}`
      );
    },
    TEST_TIMEOUT_MS
  );
});

// # how to run:
//   GCP_SA_KEY='<full SA key JSON, one line>' GEE_PROJECT=hermes-fesolucoes \
//     bun test src/lib/ee.smoke.test.ts
// GEE_SERVICE_ACCOUNT_KEY is accepted in place of GCP_SA_KEY. The key is JSON
// content, not a file path: GCP_SA_KEY="$(cat key.json)" works.
