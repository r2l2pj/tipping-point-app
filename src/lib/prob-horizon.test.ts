// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { describe, expect, test } from "bun:test";

import type { ManifestLayer } from "./types";
import { probFrame, probHorizonsAvailable } from "./layers";

const frame = (h: string, date: string): ManifestLayer => ({
  id: `p_trigger_${h}`,
  date,
  png: `rs_2024/png/p_trigger_${h}_${date.replaceAll("-", "")}.png`,
  issued_at: "2024-05-02T00:00:00Z",
  forecast_source: "noaa-gfs",
});

const ALL: ManifestLayer[] = ["24h", "48h", "72h", "7d", "14d"].flatMap((h) => [
  frame(h, "2024-05-02"),
  frame(h, "2024-05-03"),
]);

describe("P(trigger) horizons (L27)", () => {
  test("available horizons follow the manifest, in display order", () => {
    expect(probHorizonsAvailable(ALL)).toEqual(["24h", "48h", "72h", "7d", "14d"]);
    expect(probHorizonsAvailable([frame("72h", "2024-05-02"), frame("24h", "2024-05-02")])).toEqual(["24h", "72h"]);
    expect(probHorizonsAvailable([{ id: "tpi_slide", date: "2024-05-02", png: "x.png" }])).toEqual([]);
  });

  test("probFrame picks the horizon and the day; 14d never matches 14d-less ids", () => {
    expect(probFrame(ALL, "7d", "2024-05-03")?.png).toContain("p_trigger_7d_20240503");
    expect(probFrame(ALL, "24h", "2024-05-02")?.id).toBe("p_trigger_24h");
    expect(probFrame([frame("24h", "2024-05-02")], "14d", "2024-05-02")).toBeUndefined();
    // legacy single family (no horizon ids) still resolves
    expect(probFrame([{ id: "p_trigger", date: "2024-05-02", png: "p.png" }], "24h", "2024-05-02")?.id).toBe("p_trigger");
  });
});
