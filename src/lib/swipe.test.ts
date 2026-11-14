// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { describe, expect, test } from "bun:test";

import { cameraPatch, clipPathFor, dragStep, pctFromClientX } from "./swipe";

describe("clipPathFor", () => {
  test("hides the left X% of the after layer", () => {
    expect(clipPathFor(50)).toBe("inset(0 0 0 50%)");
    expect(clipPathFor(12.5)).toBe("inset(0 0 0 12.5%)");
    expect(clipPathFor(0)).toBe("inset(0 0 0 0%)");
  });
});

describe("pctFromClientX", () => {
  const rectLeft = 100;
  const rectWidth = 400;

  test("maps clientX onto the track as a percent", () => {
    expect(pctFromClientX(300, rectLeft, rectWidth)).toBe(50);
    expect(pctFromClientX(200, rectLeft, rectWidth)).toBe(25);
  });

  test("clamps at the left edge", () => {
    expect(pctFromClientX(100, rectLeft, rectWidth)).toBe(5);
    expect(pctFromClientX(-9999, rectLeft, rectWidth)).toBe(5);
  });

  test("clamps at the right edge", () => {
    expect(pctFromClientX(500, rectLeft, rectWidth)).toBe(95);
    expect(pctFromClientX(9999, rectLeft, rectWidth)).toBe(95);
  });
});

describe("cameraPatch", () => {
  test("passes every camera field through to jumpTo options", () => {
    expect(
      cameraPatch({ center: [-51.5, -30.0], zoom: 9, bearing: 15, pitch: 30 })
    ).toEqual({ center: [-51.5, -30.0], zoom: 9, bearing: 15, pitch: 30 });
  });

  test("optional bearing/patch fields stay undefined when absent", () => {
    const patch = cameraPatch({ center: [0, 0], zoom: 5 });
    expect(patch.center).toEqual([0, 0]);
    expect(patch.zoom).toBe(5);
    expect(patch.bearing).toBeUndefined();
    expect(patch.pitch).toBeUndefined();
  });
});

describe("dragStep", () => {
  test("moves 2% in the direction of the arrow", () => {
    expect(dragStep(50, 1)).toBe(52);
    expect(dragStep(50, -1)).toBe(48);
  });

  test("clamps at the track edges", () => {
    expect(dragStep(94, 1)).toBe(95);
    expect(dragStep(6, -1)).toBe(5);
  });
});
