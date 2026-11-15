// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { className, fold, parsePlaces, searchPlaces } from "./places";

const P = parsePlaces(JSON.parse(readFileSync(join(process.cwd(), "test/fixtures/now/places.json"), "utf8")))!;

describe("city search (lead-analysis places@1)", () => {
  test("parses the schema", () => {
    expect(P.dates).toEqual(["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"]);
    expect(P.places).toHaveLength(4);
    expect(P.places[0]).toMatchObject({ id: "4314902", uf: "RS", alert: true, alertLevel: "Alto", peopleHigh: 5400 });
    expect(P.places[1].pTrigger["24h"]).toBeNull();
    expect(parsePlaces({})).toBeUndefined();
  });
  test("accent-insensitive: 'sao jose' finds São José before São José dos Pinhais (exact words win)", () => {
    expect(fold("São José dos Pinhais")).toBe("sao jose dos pinhais");
    expect(searchPlaces(P.places, "sao jose").map((p) => p.name)).toEqual(["São José", "São José dos Pinhais"]);
  });
  test("prefix, UF and one-typo matches; nothing for nonsense", () => {
    expect(searchPlaces(P.places, "porto")[0].name).toBe("Porto Alegre");
    expect(searchPlaces(P.places, "florian")[0].name).toBe("Florianópolis");
    expect(searchPlaces(P.places, "florinopolis")[0]?.name).toBe("Florianópolis");
    expect(searchPlaces(P.places, "jose pr").map((p) => p.name)).toEqual(["São José dos Pinhais"]);
    expect(searchPlaces(P.places, "xyzzy")).toEqual([]);
    expect(searchPlaces(P.places, "")).toEqual([]);
  });
  test("class names", () => {
    expect(className(3)).toBe("Critical");
    expect(className(null)).toBe("no data");
  });
});
