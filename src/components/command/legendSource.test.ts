import { describe, expect, test } from "bun:test";
import { legendSource } from "./LayersColumn";

describe("legend source line (rule 3)", () => {
  test("names the NASA sources, the unit and the frame date", () => {
    expect(legendSource("2024-05-02")).toBe("TPI 0–1 from NASA GPM IMERG rain, SMAP soil moisture and NASADEM terrain · May 2, 2024");
    expect(legendSource()).not.toContain("·");
  });
});
