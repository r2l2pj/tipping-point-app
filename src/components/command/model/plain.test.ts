import { expect, test } from "bun:test";
import { plainText } from "./plain";

test("v6 jargon is rewritten in plain language", () => {
  expect(plainText(">3 dB darkening Oct 24 -> Nov 5 inside the river corridor (UNGATED — no per-scene Otsu; not a flood product)"))
    .toBe(">3 dB darkening Oct 24 -> Nov 5 inside the river corridor (not a flood map — no automatic threshold)");
  expect(plainText("teammate zip change polygons (cross-check only)")).toBe("teammate change map (cross-check)");
  expect(plainText("local rain at Uruguaiana never reached its own P99 — the flood was driven by upstream-basin rain (see forecast_proof)."))
    .toBe("local rain at Uruguaiana never reached its extreme level — the flood was driven by upstream-basin rain (see the upstream-rain test).");
  expect(plainText("as published (see lead_time_metrics).")).toBe("as published.");
  expect(plainText("baseline (pair geometry; teammate zip pre date)")).toBe("baseline (pair geometry; teammate pair pre date)");
  expect(plainText("permanent water (JRC GSW occurrence >= 50 %)")).toBe("permanent water (reference mask)");
  expect(plainText("Rain at Uruguaiana (see the chart).")).toBe("Rain at Uruguaiana (see the chart).");
});
