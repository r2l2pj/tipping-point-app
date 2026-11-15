// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { bundle } from "./fixtures";
import { compactLayerUrls, expandLayerUrls } from "./layerUrls";

describe("layer URL compaction (page budget)", () => {
  const B = "https://raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data/wa_2025/";
  const b = bundle({ manifest: { event: "wa_2025", layers: [
    { id: "tpi_flood", date: "2025-12-10", png: `${B}png/tpi_flood_20251210.png`, cog: `${B}cog/x.tif` },
    { id: "tpi_slide_gfs_d1", date: "2025-12-11", png: `${B}png/tpi_slide_gfs_d1_20251211.png`, cog: null },
  ] } as never });
  test("round trip restores the exact URLs; the payload loses the prefix", () => {
    const c = compactLayerUrls(b);
    expect(c.layerUrlBase).toBe(B);
    expect(c.manifest!.layers[0].png).toBe("png/tpi_flood_20251210.png");
    expect(expandLayerUrls(c).manifest!.layers).toEqual(b.manifest!.layers);
  });
  test("relative or mixed URLs are left alone", () => {
    const rel = bundle({ manifest: { event: "x", layers: [{ id: "a", png: "png/a.png" }] } as never });
    expect(compactLayerUrls(rel)).toBe(rel);
    expect(expandLayerUrls(rel)).toBe(rel);
  });
});
