// @ts-expect-error -- bun:test resolves under `bun test`
import { expect, test } from "bun:test";
import { healthOk } from "./health";

const NOW = Date.parse("2026-11-15T20:00:00Z");
test("ok while the Now data is at most 6 h old", () => {
  expect(healthOk("2026-11-15T19:17:05Z", NOW)).toBe(true);
  expect(healthOk("2026-11-15T14:00:00Z", NOW)).toBe(true); // exactly 6 h
});
test("not ok when older than 6 h, missing or unreadable", () => {
  expect(healthOk("2026-11-15T13:59:00Z", NOW)).toBe(false);
  expect(healthOk(undefined, NOW)).toBe(false);
  expect(healthOk(null, NOW)).toBe(false);
  expect(healthOk("not a date", NOW)).toBe(false);
});
