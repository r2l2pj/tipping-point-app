// L52 U1: big map views and the headline card.
// @ts-expect-error -- bun:test resolves under `bun test`
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { activeView, VIEWS } from "./views";
import { headlineFor } from "./headline";
import { parsePlaces } from "./places";

test("the view follows the layers on (deep links keep ?layers=)", () => {
  expect(activeView(["imerg", "hand"])).toBe("rain");
  expect(activeView(["flood", "tpi"])).toBe("risk");
  expect(activeView(["flood"])).toBe("radar");
  expect(activeView(["tpi"])).toBe("risk");
  expect(activeView(["ptrigger"])).toBe("risk");
  expect(activeView(["hand"])).toBeUndefined();
  expect(VIEWS.map((v) => v.label)).toEqual(["Risk now & next days", "Rain", "Radar — NISAR", "Satellite"]);
});

test("headline: total people in High/Critical cells and the top municipality", () => {
  const P = parsePlaces(JSON.parse(readFileSync(join(process.cwd(), "test/fixtures/now/places.json"), "utf8")))!;
  const h = headlineFor(P)!;
  const top = [...P.places].sort((a, b) => (b.peopleHigh ?? 0) - (a.peopleHigh ?? 0))[0];
  expect(h.top.id).toBe(top.id);
  expect(h.text).toMatch(/^Today & tomorrow: [\d,]+ people in High or Critical risk areas · most in .+ \([A-Z]{2}\)$/);
  expect(headlineFor({ dates: [], places: [] })).toBeUndefined();
});
