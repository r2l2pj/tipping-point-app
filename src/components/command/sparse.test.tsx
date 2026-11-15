// Conductor (v6): the featured Uruguaiana replay hides blocks with no data.
// @ts-expect-error -- bun:test resolves under `bun test`
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CommandCenterView } from "./CommandCenter";
import { bundle } from "./model/fixtures";

const noop = () => {};
const UNAVAILABLE = { state: "unavailable", alerts: [] } as const;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const render = (id: string) => text(renderToStaticMarkup(
  <CommandCenterView cases={[bundle({ id, title: id })]} alertList={UNAVAILABLE} view="command" onView={noop} initial={{ detailsOpen: true }} />));

test("featured replay without data: no 'pending' / 'not published yet' blocks", () => {
  const t = render("rs_uruguai_2026");
  // The header's run-time chip is metadata of the fixture, not a section.
  const panel = t.slice(t.indexOf("Start here"));
  expect(panel).not.toMatch(/\bpending\b|not published yet/);
  expect(t).not.toContain("Who is affected");
  expect(t).not.toContain("Landslide scar candidates");
});
test("other replays keep the full layout (missing data stays labelled)", () => {
  const t = render("wa_2025");
  expect(t).toContain("Who is affected");
  expect(t).toMatch(/pending|not published yet/);
});

test("WA: the forecast-vs-NISAR note (metrics forecast_nisar_overlap_note) shows in the Radar tab", () => {
  const note = "NOAA forecast runs 1–3 days before the Dec 8 onset flagged 0% of the 27.9 km² NISAR flood area as High/Critical.";
  const html = renderToStaticMarkup(<CommandCenterView cases={[bundle({ id: "wa_2025", metricsView: { forecast_nisar_overlap_note: note } as never })]}
    alertList={UNAVAILABLE} view="command" onView={noop} panelTab="all" />);
  expect(text(html)).toContain("Forecast vs NISAR: " + note);
});
