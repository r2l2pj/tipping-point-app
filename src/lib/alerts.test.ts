// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { describe, expect, test } from "bun:test";

import {
  ALERT_FOOTER,
  alertDataDates,
  candidatesToAlerts,
  heldLabel,
  isQuietHourBRT,
  levelForClass,
} from "./alerts";

const places: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Encantado", kind: "town" },
      geometry: { type: "Point", coordinates: [-51.87, -29.24] },
    },
    {
      type: "Feature",
      properties: { name: "Porto Alegre", kind: "city" },
      geometry: { type: "Point", coordinates: [-51.23, -30.03] },
    },
    {
      type: "Feature",
      properties: { name: "Rio Taquari", kind: "river" },
      geometry: { type: "Point", coordinates: [-51.8, -29.3] },
    },
  ],
};

// Midday BRT so quiet-hours flags never leak into the baseline tests.
const ISSUED = "2026-11-14T15:00:00Z";

describe("levelForClass", () => {
  test("class index: only Alto (2) and Crítico (3) upgrade", () => {
    expect(levelForClass(0)).toBeUndefined();
    expect(levelForClass(1)).toBeUndefined();
    expect(levelForClass(2)).toBe("warning");
    expect(levelForClass(3)).toBe("emergency");
  });

  test("float 0-1 TPI: same 0.4/0.6 class edges", () => {
    expect(levelForClass(0.39)).toBeUndefined();
    expect(levelForClass(0.4)).toBe("warning");
    expect(levelForClass(0.55)).toBe("warning");
    expect(levelForClass(0.6)).toBe("emergency");
    expect(levelForClass(0.9)).toBe("emergency");
  });

  test("out-of-range and non-numeric input is suppressed", () => {
    expect(levelForClass(4)).toBeUndefined();
    expect(levelForClass(-1)).toBeUndefined();
    expect(levelForClass(1.5)).toBeUndefined();
    expect(levelForClass(NaN)).toBeUndefined();
    expect(levelForClass(undefined)).toBeUndefined();
  });
});

describe("isQuietHourBRT", () => {
  // America/Sao_Paulo is UTC-3 (no DST since 2019).
  test("window edges: 22:59 out, 23:00 in, 05:59 in, 06:00 out", () => {
    expect(isQuietHourBRT(new Date("2026-11-15T01:59:00Z"))).toBe(false); // 22:59
    expect(isQuietHourBRT(new Date("2026-11-15T02:00:00Z"))).toBe(true); // 23:00
    expect(isQuietHourBRT(new Date("2026-11-15T08:59:00Z"))).toBe(true); // 05:59
    expect(isQuietHourBRT(new Date("2026-11-15T09:00:00Z"))).toBe(false); // 06:00
  });

  test("midday BRT is outside the window", () => {
    expect(isQuietHourBRT(new Date(ISSUED))).toBe(false); // 12:00
  });
});

describe("candidatesToAlerts", () => {
  test("Baixo/Moderado candidates are skipped", () => {
    const alerts = candidatesToAlerts(
      [{ class: 0 }, { class: 1 }, { class: 2 }, { class: 3 }],
      { issuedAt: ISSUED }
    );
    expect(alerts.map((a) => a.level)).toEqual(["warning", "emergency"]);
  });

  test("title, region and hazard from label text", () => {
    const [slide, flood, dflt] = candidatesToAlerts(
      [
        { class: 3, label: "deslizamento", centroid: [-51.9, -29.3] },
        { class: 2, label: "flood extent", centroid: [-51.2, -30.0] },
        { class: 2, centroid: [-51.9, -29.3] },
      ],
      { places, issuedAt: ISSUED }
    );
    expect(slide.title).toBe("Tipping Point: CRITICAL landslide risk");
    expect(slide.region).toBe("Encantado"); // nearest place; rivers excluded
    expect(flood.title).toBe("Tipping Point: HIGH flood risk");
    expect(flood.region).toBe("Porto Alegre");
    expect(dflt.hazard).toBe("landslide"); // unknown label defaults
  });

  test("certainty follows pixel count", () => {
    const alerts = candidatesToAlerts(
      [
        { class: 2, pixels: 50 },
        { class: 2, pixels: 10 },
        { class: 2, pixels: 5 },
        { class: 2 },
      ],
      { issuedAt: ISSUED }
    );
    expect(alerts.map((a) => a.certainty)).toEqual([
      "high",
      "medium",
      "low",
      "low",
    ]);
  });

  test("valid window is issue time -> +12h; data_dates pass through", () => {
    const [a] = candidatesToAlerts([{ class: 3 }], {
      issuedAt: ISSUED,
      dataDates: { imerg: "2026-11-14T08:00:00Z", smap: "2026-11-11" },
    });
    expect(a.valid_from).toBe("2026-11-14T15:00:00.000Z");
    expect(a.valid_to).toBe("2026-11-15T03:00:00.000Z");
    expect(a.data_dates?.imerg).toBe("2026-11-14T08:00:00Z");
  });

  test("hold candidate -> held flag and 'held' label", () => {
    const [a] = candidatesToAlerts([{ class: 3, hold: true }], {
      issuedAt: ISSUED,
    });
    expect(a.held).toBe(true);
    expect(heldLabel(a)).toBe("held");
    expect(heldLabel({ hold: true })).toBe("held");
    expect(heldLabel({})).toBeUndefined();
  });

  test("quiet hours: warning held, Crítico still emitted but flagged", () => {
    const [w, e] = candidatesToAlerts([{ class: 2 }, { class: 3 }], {
      issuedAt: "2026-11-15T04:00:00Z", // 01:00 BRT
    });
    expect(w.held).toBe(true);
    expect(w.quiet).toBe(false);
    expect(e.held).toBe(false);
    expect(e.quiet).toBe(true);
  });

  test("every guidance uses 'your region', ends with the SMS footer", () => {
    const alerts = candidatesToAlerts(
      [
        { class: 2, pixels: 80, label: "flood" },
        { class: 3, hold: true },
        { class: 0.65 },
      ],
      { places, issuedAt: ISSUED }
    );
    expect(alerts).toHaveLength(3);
    for (const a of alerts) {
      expect(a.guidance).toContain("your region");
      expect(a.guidance).not.toMatch(/your home/i);
      expect(a.guidance.endsWith(ALERT_FOOTER)).toBe(true);
      expect(a.guidance).toContain("SMS 40199");
    }
  });
});

describe("alertDataDates", () => {
  test("keeps string entries, drops nulls and arrays", () => {
    expect(
      alertDataDates({
        imerg: "2026-11-14T08:00:00Z",
        smap: null,
        nisar_passes: [{ date: "2026-11-09", track: "172D" }],
      })
    ).toEqual({ imerg: "2026-11-14T08:00:00Z" });
    expect(alertDataDates(undefined)).toBeUndefined();
    expect(alertDataDates({ smap: null })).toBeUndefined();
  });
});
