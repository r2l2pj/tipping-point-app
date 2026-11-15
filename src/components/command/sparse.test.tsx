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
