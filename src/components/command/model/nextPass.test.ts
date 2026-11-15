// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { liveBundle, zone, zones } from "./fixtures";
import { nextLookText, nextPassFrom, nextPassOf, NISAR_FRAMING } from "./nextPass";
import { radarCard } from "./radar";
import { priorityAreas } from "./areas";

// lead-analysis L43 shape
const file = { generated_at: "2026-11-15T15:30:00Z", repeat_days: 12, method: "… expected, not guaranteed",
  passes: [
    { utc: "2026-11-14T09:37:00Z", track: 125, direction: "descending", frame: 100 },
    { utc: "2026-11-18T09:37:00Z", track: 132, direction: "ascending", frame: 166, covers: ["4205407"] },
    { utc: "2026-11-19T21:16:00Z", track: 24, direction: "descending", frame: 101 },
  ] };
const NOW = Date.parse("2026-11-15T15:00:00Z");

describe("L43 next NISAR look", () => {
  test("soonest pass still ahead; BRT; track; 'expected'", () => {
    const n = nextPassFrom(file, NOW)!;
    expect(n).toEqual({ utc: "2026-11-18T09:37:00Z", track: "132" });
    expect(nextLookText(n)).toBe("Next NISAR look (expected): Nov 18, 06:37 AM BRT (track 132)");
    expect(nextPassFrom({ passes: [] }, NOW)).toBeUndefined();
    expect(nextPassFrom(undefined, NOW)).toBeUndefined();
  });
  test("Now radar card: line + framing; zones and alerts from their own fields", async () => {
    const card = radarCard(liveBundle({ nisarNext: nextPassFrom(file, NOW) } as never));
    expect(card.nextLook).toBe("Next NISAR look (expected): Nov 18, 06:37 AM BRT (track 132)");
    expect(card.framing).toBe(NISAR_FRAMING);
    expect(radarCard(liveBundle()).nextLook).toBeUndefined();
    const areas = priorityAreas(liveBundle({ zones: zones([zone(1, { next_nisar_pass_utc: "2026-11-18T09:37:00Z", next_nisar_track: 132 }), zone(2)]) }));
    expect(areas[0].nextLook).toBe("Next NISAR look (expected): Nov 18, 06:37 AM BRT (track 132)");
    expect(areas[1].nextLook).toBeUndefined();
    expect(nextPassOf({ next_nisar_pass_utc: null })).toBeUndefined();
    const AlertCard = (await import("../AlertCard")).default;
    const html = renderToStaticMarkup(createElement(AlertCard, {
      alert: { level: "warning", area: "Florianópolis", guidance: "Stay alert.", certainty: "medium", hazard: "flood", next_nisar_pass_utc: "2026-11-18T09:37:00Z", next_nisar_track: 132 } as never,
      onViewOnMap: () => {} }));
    expect(html).toContain("Next NISAR look (expected): Nov 18, 06:37 AM BRT (track 132)");
  });
});

describe("external review: badge + calm day", () => {
  test("alert badge says 'Critical risk', never 'emergency'", async () => {
    const AlertCard = (await import("../AlertCard")).default;
    const html = renderToStaticMarkup(createElement(AlertCard, {
      alert: { level: "emergency", area: "X", guidance: "g", certainty: "medium", hazard: "flood" } as never, onViewOnMap: () => {} }));
    expect(html).toContain(">Critical risk<");
    expect(html.toLowerCase()).not.toContain(">emergency<");
  });
  test("live today frame with 0 km² High+ -> caption says no High or Critical areas today", async () => {
    const { mapCaption, CALM_TODAY } = await import("./steps");
    const live = liveBundle({
      manifest: { layers: [{ id: "tpi_flood_d0", date: "2026-11-15", png: "png/tpi_flood_d0.png", kind: "observed" }] },
      summary: { alert_km2: { slide: 0, flood: 0 }, critical_km2: { slide: 0, flood: 0 } },
    } as never);
    const steps = [{ date: "2026-11-15", day: true }] as never;
    expect(mapCaption(live, steps, 0, "flood", ["tpi"]).text).toContain(CALM_TODAY);
    const busy = liveBundle({ manifest: live.manifest, summary: { alert_km2: { flood: 12 } } } as never);
    expect(mapCaption(busy, steps, 0, "flood", ["tpi"]).text).not.toContain(CALM_TODAY);
  });
});

test("L48 caption: ML layer on, TPI off -> names the ML likelihood, not 'TPI index off'", async () => {
  const { mapCaption } = await import("./steps");
  const live = liveBundle({ manifest: { layers: [{ id: "p_trigger_24h", date: "2026-11-15", png: "png/p.png", kind: "forecast" }] } } as never);
  const text = mapCaption(live, [{ date: "2026-11-15", day: true }] as never, 0, "slide", ["ptrigger", "flood"]).text;
  expect(text).toStartWith("Landslide likelihood (ML, experimental) · Nov 15, 2026");
  expect(text).not.toContain("TPI index off");
});
