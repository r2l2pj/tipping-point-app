import { describe, expect, test } from "bun:test";
import { isPermanentFrameFailure } from "./mapFrameErrors";

describe("isPermanentFrameFailure", () => {
  test("a missing file stays failed", () => {
    expect(isPermanentFrameFailure({ status: 404 })).toBe(true);
    expect(isPermanentFrameFailure({ status: 403 })).toBe(true);
  });

  test("a network or CORS failure is tried again", () => {
    // MapLibre: "AJAXError: Failed to fetch (0)".
    expect(isPermanentFrameFailure({ status: 0, message: "Failed to fetch" })).toBe(false);
    expect(isPermanentFrameFailure(new TypeError("Failed to fetch"))).toBe(false);
    expect(isPermanentFrameFailure(undefined)).toBe(false);
  });

  test("a server error is tried again", () => {
    expect(isPermanentFrameFailure({ status: 503 })).toBe(false);
  });
});
