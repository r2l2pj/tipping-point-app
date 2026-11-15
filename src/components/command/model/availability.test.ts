// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { availability, hasNisarPair, missingText, NO_RADAR_TEXT } from "./availability";
import { dataStatus, refreshHours, staleLimitMs } from "./dataStatus";
import { bundle, liveBundle, zones } from "./fixtures";

describe("availability", () => {
  test("ok when the value is present", () => {
    expect(availability(bundle({ zones: zones([]) }), "priority_zones")).toEqual({ state: "ok" });
    expect(availability(bundle({ metricsView: { iou: 0.7 } }), "iou")).toEqual({ state: "ok" });
  });

  test("pending when the loader lists the key", () => {
    const b = bundle({ pending: ["metrics", "priority_zones"] });
    expect(availability(b, "priority_zones")).toEqual({ state: "pending" });
    expect(missingText(availability(b, "metrics"))).toBe("not published yet");
  });

  test("absent carries the reason of _null_reasons", () => {
    const b = bundle({
      products: { landslide_candidates: null } as never,
      nullReasons: { landslide_candidates: "no landslide candidate product yet" },
    });
    const a = availability(b, "landslide_candidates");
    expect(a).toEqual({ state: "absent", reason: "no landslide candidate product yet" });
    // The raw pipeline reason never reaches the screen.
    expect(missingText(a)).toBe("pending");
  });

  test("_null_reasons map to short user text", () => {
    const reason = (r: string) => missingText({ state: "absent", reason: r });
    expect(reason("No NISAR coverage — event predates launch (Jul 2025)")).toBe("before NISAR launch");
    expect(reason("No local labeled feature CSV/parquet table found")).toBe("pending");
    expect(reason("not yet produced")).toBe("pending");
  });

  test("a reason in the raw metrics blob is read too", () => {
    const b = bundle({ metricsView: {}, metrics: { event: "x", _null_reasons: { iou: "no reference" } } as never });
    expect(availability(b, "iou")).toEqual({ state: "absent", reason: "no reference" });
    expect(missingText(availability(b, "iou"))).toBe("pending");
  });

  test("radar is not applicable for a replay without a pair", () => {
    expect(availability(bundle(), "radar")).toEqual({ state: "not-applicable", text: NO_RADAR_TEXT });
    expect(availability(liveBundle(), "radar")).toEqual({ state: "pending" });
    const pair = bundle({ data_dates: { nisar_pre: "2025-12-04", nisar_post: "2025-12-16" } });
    expect(hasNisarPair(pair)).toBe(true);
    expect(availability(pair, "radar")).toEqual({ state: "ok" });
  });
});

describe("availability of products the bundle does not carry", () => {
  const wa = bundle({ products: { flood_confirmed: "wa_2025/geojson/flood_confirmed.geojson", landslide_candidates: null } as never });

  test("a declared file is available; null and undeclared are not", () => {
    expect(availability(wa, "flood_confirmed")).toEqual({ state: "ok" });
    expect(availability(wa, "landslide_candidates").state).toBe("absent");
    expect(availability(wa, "landslide_catalog").state).toBe("pending");
    expect(availability(wa, "radar")).toEqual({ state: "ok" });
  });

  test("loading and missing states of a browser fetch", () => {
    const declared = bundle({ products: { landslide_candidates: "x.geojson" } });
    expect(missingText(availability({ ...declared, lazy: { landslide_candidates: "loading" } }, "landslide_candidates"))).toBe("loading");
    expect(missingText(availability({ ...declared, lazy: { landslide_candidates: "missing" } }, "landslide_candidates"))).toBe("not published yet");
  });
});

describe("dataStatus", () => {
  const t0 = Date.parse("2026-11-14T12:00:00Z");
  const live = (updated_at?: string) => liveBundle({ updated_at, summary: {} });

  test("the stale limit is two refresh periods, from one setting", () => {
    expect(refreshHours(undefined)).toBe(3);
    expect(refreshHours("4")).toBe(4);
    expect(refreshHours("x")).toBe(3);
    expect(staleLimitMs(3)).toBe(6 * 3600 * 1000);
  });

  test("live, stale and unknown age", () => {
    expect(dataStatus(live("2026-11-14T10:00:00Z"), t0, 3).kind).toBe("live");
    expect(dataStatus(live("2026-11-14T05:00:00Z"), t0, 3).kind).toBe("stale");
    expect(dataStatus(live("2026-11-14T05:00:00Z"), t0, 4).kind).toBe("live");
    expect(dataStatus(live(undefined), t0, 3).kind).toBe("unknown-age");
  });

  test("never 'live' before the browser clock is known", () => {
    expect(dataStatus(live("2026-11-14T10:00:00Z")).kind).toBe("unknown-age");
  });

  test("a fallback bundle is real last-saved data, with or without metrics", () => {
    const saved = bundle({ fallback: true, metricsView: { iou: 0.7 }, updated_at: "2026-11-14T10:00:00Z" });
    expect(dataStatus(saved, t0)).toEqual({ kind: "last-saved", date: "2026-11-14T10:00:00Z" });
    expect(dataStatus(bundle({ fallback: true })).kind).toBe("last-saved");
    expect(dataStatus(liveBundle({ fallback: true })).kind).toBe("last-saved");
  });

  test("a replay is never live or stale", () => {
    expect(dataStatus(bundle({ updated_at: "2025-12-21T00:00:00Z" }), t0).kind).toBe("archive");
    expect(dataStatus(bundle(), t0).kind).toBe("unknown-age");
  });
});
