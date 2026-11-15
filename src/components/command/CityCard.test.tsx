// City search (Lucas): the card text and where the search box shows up.
// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import CityCard from "./CityCard";
import { CommandCenterView } from "./CommandCenter";
import { bundle, liveBundle } from "./model/fixtures";
import { parsePlaces } from "./model/places";

const P = parsePlaces(JSON.parse(readFileSync(join(process.cwd(), "test/fixtures/now/places.json"), "utf8")))!;
const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const UNAVAILABLE = { state: "unavailable", alerts: [] } as const;

describe("City card", () => {
  test("name, population, alert, d0..d3 strips, ML horizons; no broken values", () => {
    const html = renderToStaticMarkup(<CityCard place={P.places[0]} dates={P.dates} onShow={noop} onClose={noop} />);
    const t = text(html);
    expect(t).toContain("Porto Alegre RS");
    expect(t).toMatch(/residents \(estimate, GPW\)/);
    expect(t).toMatch(/Experimental alert: High flood risk/);
    expect(t).toContain("Today");
    expect(t).toMatch(/Flood risk/);
    expect(t).toMatch(/Landslide risk/);
    expect(t).toMatch(/next 24 h: \d\.\d\d/);
    expect(t).toContain("Show on map");
    expect(t).not.toMatch(/undefined|NaN|null|Crítico|Alto/);
  });
  test("a city without ML values or alert shows neither", () => {
    const t = text(renderToStaticMarkup(<CityCard place={P.places[1]} dates={P.dates} onShow={noop} onClose={noop} />));
    expect(t).not.toMatch(/Experimental alert|next 24 h/);
  });
});

describe("City search box", () => {
  const live = liveBundle({ products: { places: "places.json" } } as never);
  test("in the header when the live run publishes places.json; '/' hint in the placeholder", () => {
    const html = renderToStaticMarkup(<CommandCenterView cases={[live]} alertList={UNAVAILABLE} view="command" onView={noop} />);
    expect(html).toContain("data-city-search");
    expect(html).toContain('placeholder="Search a city ( / )"');
    expect(html).toContain('role="combobox"');
  });
  test("absent when no live run declares places", () => {
    const html = renderToStaticMarkup(<CommandCenterView cases={[liveBundle()]} alertList={UNAVAILABLE} view="command" onView={noop} />);
    expect(html).not.toContain("data-city-search");
  });
  test("Replay: a 'Back to live' chip on the map; none in Now", () => {
    const replay = renderToStaticMarkup(<CommandCenterView cases={[live, bundle()]} alertList={UNAVAILABLE} view="command" onView={noop} initialCase="wa_2025" />);
    expect(replay).toContain("data-back-to-live");
    const now = renderToStaticMarkup(<CommandCenterView cases={[live, bundle()]} alertList={UNAVAILABLE} view="command" onView={noop} />);
    expect(now).not.toContain("data-back-to-live");
  });
});
