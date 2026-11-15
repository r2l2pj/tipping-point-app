// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import path from "node:path";
// @ts-expect-error -- plain .mjs script module, no types
import { keepForPublic } from "../../scripts/sync-filter.mjs";

const NOW = path.join("/repo", "data", "now");
const DATA = path.join("/repo", "data");
const k = (root: string, ...p: string[]) => keepForPublic(path.join(root, ...p), root);

describe("sync-data filter (dev hung on 'Compiling /' after copying 6 GB)", () => {
  test("now/: static/ and raw/ (any depth) and heavy source files are skipped", () => {
    expect(k(NOW, "static")).toBe(false);
    expect(k(NOW, "static", "south_brazil", "nasadem", "S30W052.hgt")).toBe(false);
    expect(k(NOW, "cog", "smap_l4", "raw", "SMAP_L4.h5")).toBe(false);
    expect(k(NOW, "cog", "smap_l4", "raw")).toBe(false);
    expect(k(NOW, "MCD12Q1.A2024001.h13v11.061.hdf")).toBe(false);
    expect(k(NOW, "nasadem.zip")).toBe(false);
    expect(k(NOW, "prev_classes.npz")).toBe(false);
  });
  test("what the app reads is kept: manifests, png frames, geojson, live COGs, response/", () => {
    expect(k(NOW)).toBe(true);
    expect(k(NOW, "manifest.json")).toBe(true);
    expect(k(NOW, "png", "tpi_flood_d1.png")).toBe(true);
    expect(k(NOW, "cog", "tpi_flood_d1.tif")).toBe(true);
    expect(k(NOW, "response", "summary.json")).toBe(true);
    expect(k(DATA, "wa_2025", "png", "nisar_pre_20251204.png")).toBe(true);
    expect(k(DATA, "static", "south_brazil", "hand.tif")).toBe(false);
  });
});
