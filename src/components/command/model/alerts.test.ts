// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { alertsByRegion, buildAlertList } from "./alerts";
import { bundle, liveBundle } from "./fixtures";
import { ageText, fmtBrt, fmtDate, fmtHours } from "./format";
import { sourceRows } from "./sources";

describe("alert list", () => {
  const now = (candidates?: unknown[]) => liveBundle({
    updated_at: "2026-11-14T15:00:00Z",
    nowAlerts: candidates ? { candidates: candidates as never } : undefined,
  });

  test("a load failure or an unpublished source is 'unavailable', never 'none'", () => {
    expect(buildAlertList({ now: null, legacy: null }).state).toBe("unavailable");
    expect(buildAlertList({}).state).toBe("unavailable");
    expect(buildAlertList({ now: now(), legacy: undefined })).toEqual({
      state: "unavailable", alerts: [], dataTime: "2026-11-14T15:00:00Z",
    });
  });

  test("a loaded source with no entries is 'none'", () => {
    expect(buildAlertList({ now: now([]) }).state).toBe("none");
    expect(buildAlertList({ now: now([{ class: 1, label: "low" }]) }).state).toBe("none");
    expect(buildAlertList({ now: null, legacy: { schema: "alerts@1", alerts: [] } }).state).toBe("none");
  });

  test("candidates become alerts, highest level first", () => {
    const list = buildAlertList({ now: now([
      { class: 2, label: "landslide", pixels: 12 },
      { class: 3, label: "flood", pixels: 80, hold: true },
    ]) });
    expect(list.state).toBe("alerts");
    expect(list.alerts.map((a) => a.level)).toEqual(["emergency", "warning"]);
    expect(list.alerts[0]).toMatchObject({ held: true, certainty: "high", valid_from: "2026-11-14T15:00:00.000Z" });
    expect(list.alerts[0].guidance).toContain("SMS 40199");
    expect(alertsByRegion(list.alerts)).toEqual([{ region: "monitored region", level: "emergency", count: 2 }]);
  });
});

describe("format", () => {
  test("canonical dates preserve calendar dates and render timestamps in BRT", () => {
    expect(fmtDate("2026-11-11")).toBe("Nov 11, 2026");
    expect(fmtDate("2026-11-11T01:00:00Z")).toBe("Nov 10, 2026");
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("invalid")).toBe("invalid");
  });

  test("a date-only value renders the same day, not shifted back", () => {
    expect(fmtBrt("2026-11-11")).toContain("Nov 11");
    expect(fmtBrt("2026-11-11")).not.toContain("Nov 10");
    expect(fmtBrt("2026-11-11T15:00:00Z")).toContain("BRT");
  });

  test("hours are whole", () => {
    expect(fmtHours(47.5)).toBe("48 h");
    expect(fmtHours(undefined)).toBe("not published yet");
  });

  test("age text", () => {
    const now = Date.parse("2026-11-14T12:00:00Z");
    expect(ageText("2026-11-14T11:30:00Z", now)).toBe("30 min ago");
    expect(ageText("2026-11-14T07:00:00Z", now)).toBe("5 h ago");
    expect(ageText("2026-11-12", now)).toBe("2 days ago");
    expect(ageText(undefined, now)).toBeUndefined();
  });
});

describe("source rows", () => {
  test("absolute date first; age only for the live case and only with a clock", () => {
    const live = liveBundle({ data_dates: { imerg: "2026-11-14T09:00:00Z" } });
    const now = Date.parse("2026-11-14T12:00:00Z");
    expect(sourceRows(live, now)[0]).toMatchObject({ date: "Nov 14, 06:00 AM BRT", age: "3 h ago", missing: false });
    expect(sourceRows(live)[0].age).toBeUndefined();
    expect(sourceRows(live, now)[1]).toMatchObject({ date: "not published yet", missing: true });
  });

  test("replay: real pass dates, or the no-radar sentence", () => {
    const wa = bundle({ data_dates: { imerg: "2025-12-20", nisar_pre: "2025-12-04", nisar_post: "2025-12-16" },
      manifest: { event: "wa_2025", layers: [], forecast_source: "perfect-forecast" } });
    const rows = sourceRows(wa, Date.now());
    expect(rows.find((r) => r.id === "nisar")!.date).toBe("Dec 4, 2025 and Dec 16, 2025");
    expect(rows.find((r) => r.id === "forecast")!.date).toBe("perfect forecast");
    expect(rows[0].age).toBeUndefined();
    expect(sourceRows(bundle()).find((r) => r.id === "nisar")!.date).toBe("No radar for this event (before NISAR launch)");
  });
});
