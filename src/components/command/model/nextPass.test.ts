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
