// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { dataStatus, freshnessText, staleLimitMs } from "./dataStatus";
import { bundle, liveBundle } from "./fixtures";

// The L27 banner rule: "last saved data" only when the root manifest came
// from the bundled copy (the loader sets `fallback` only then), or the live
// run is stale — older than 2 x NEXT_PUBLIC_REFRESH_HOURS (default 3 h).
describe("dataStatus, banner rule (L27)", () => {
  const t0 = Date.parse("2026-11-14T12:00:00Z");

  test("a fallback bundle is last-saved, whatever the mode", () => {
    expect(dataStatus(bundle({ fallback: true, updated_at: "2026-11-14T10:00:00Z" }), t0).kind).toBe("last-saved");
    expect(dataStatus(bundle({ fallback: true }), t0).kind).toBe("last-saved");
    expect(dataStatus(liveBundle({ fallback: true, updated_at: "2026-11-14T10:00:00Z" }), t0).kind).toBe("last-saved");
  });

  test("a replay that is not a fallback is archive, never last-saved", () => {
    expect(dataStatus(bundle({ fallback: false, updated_at: "2025-12-21T00:00:00Z" }), t0).kind).toBe("archive");
    expect(dataStatus(bundle({ updated_at: "2025-12-21T00:00:00Z" }), t0).kind).toBe("archive");
  });

  test("a live run 7 h old is stale; 5 h old is live (limit 6 h)", () => {
    expect(dataStatus(liveBundle({ updated_at: "2026-11-14T05:00:00Z" }), t0).kind).toBe("stale");
    expect(dataStatus(liveBundle({ updated_at: "2026-11-14T07:00:00Z" }), t0).kind).toBe("live");
  });

  test("the default stale limit is 2 x 3 h", () => {
    expect(staleLimitMs()).toBe(6 * 3600 * 1000);
  });
});

describe("freshness text: 'Updated HH:MM BRT (X ago)'", () => {
  const run = "2026-11-15T05:56:26Z"; // 02:56 BRT
  test("live, same BRT day: clock time and age", () => {
    const now = Date.parse("2026-11-15T06:02:26Z");
    expect(freshnessText({ kind: "live", date: run }, now)).toBe("Updated 02:56 BRT (6 min ago)");
  });
  test("stale after two refresh periods, with the date when the run is from another BRT day", () => {
    const now = Date.parse("2026-11-16T05:56:26Z");
    expect(dataStatus(liveBundle({ updated_at: run }), now).kind).toBe("stale");
    expect(freshnessText({ kind: "stale", date: run }, now)).toBe("Stale · updated Nov 15, 02:56 BRT (24 h ago)");
  });
});
