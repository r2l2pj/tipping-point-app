import { SqliteStore } from "./sqlite-store";
import memoryStore from "./store";

const testModule = "bun:test";
const { describe, expect, test } = await import(testModule);
const subscriber = {
  lat: -29.24123,
  lon: -51.87987,
  consent: true,
  last_class: 2,
  last_alert_ts: 1735689600123,
  current_label: "alto'); DROP TABLE subscribers; --",
  data_date: "2025-01-01",
};

describe("SqliteStore against a real in-memory database", () => {
  test("opens the portable schema idempotently and returns null when missing", async () => {
    const store = new SqliteStore("sqlite::memory:");
    await Promise.all([store.open(), store.open()]);
    expect(await store.get(42)).toBeNull();
  });

  test("round trips all fields without rounding and normalizes numeric chat ids", async () => {
    const store = new SqliteStore(":memory:");
    await store.set(42, subscriber);
    expect(await store.get("42")).toEqual(subscriber);
  });

  test("upserts every field, preserving false, zero and absent optional strings", async () => {
    const store = new SqliteStore(":memory:");
    await store.set(42, subscriber);
    const replacement = { lat: 0, lon: 0, consent: false, last_class: 0, last_alert_ts: 0 };
    await store.set("42", replacement);
    expect(await store.get(42)).toEqual(replacement);
  });

  test("delete removes only the requested row and tolerates nonexistent ids", async () => {
    const store = new SqliteStore(":memory:");
    await store.set(42, subscriber);
    await store.set(43, { ...subscriber, consent: false });
    await store.delete("42");
    await store.delete(42);
    expect(await store.get(42)).toBeNull();
    expect(await store.get(43)).toEqual({ ...subscriber, consent: false });
  });

  test("parameterizes hostile ids and values", async () => {
    const store = new SqliteStore(":memory:");
    const id = "42'; DROP TABLE subscribers; --";
    await store.set(id, subscriber);
    expect(await store.get(id)).toEqual(subscriber);
    expect(await store.get(42)).toBeNull();
    await store.delete(id);
    expect(await store.get(id)).toBeNull();
    await store.set(42, subscriber);
    expect(await store.get(42)).toEqual(subscriber);
  });

  test("deps routes sqlite::memory: operations through SQLite", async () => {
    const saved = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = "sqlite::memory:";
      const modulePath = "./deps.ts?sqlite-test=memory";
      const { depsFromEnv } = await import(modulePath);
      const { store } = depsFromEnv();
      await store.set("sqlite-test", subscriber);
      expect(await store.get("sqlite-test")).toEqual(subscriber);
      expect(await memoryStore.get("sqlite-test")).toBeNull();
      await store.delete("sqlite-test");
      expect(await store.get("sqlite-test")).toBeNull();
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = saved;
    }
  });

  test("deps warns once and uses memory only when SQLite cannot open", async () => {
    const saved = process.env.DATABASE_URL;
    const warn = console.warn;
    const warnings: unknown[][] = [];
    try {
      process.env.DATABASE_URL = "sqlite:/dev/null/cannot-open.sqlite";
      console.warn = (...args: unknown[]) => { warnings.push(args); };
      const modulePath = "./deps.ts?sqlite-test=failure";
      const { depsFromEnv } = await import(modulePath);
      const { store } = depsFromEnv();
      await store.set("sqlite-fallback-test", subscriber);
      expect(await store.get("sqlite-fallback-test")).toEqual(subscriber);
      expect(await memoryStore.get("sqlite-fallback-test")).toEqual(subscriber);
      expect(warnings).toEqual([["telegram store: SQLite open failed; using process-local memory"]]);
      await store.delete("sqlite-fallback-test");
    } finally {
      console.warn = warn;
      if (saved === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = saved;
      await memoryStore.delete("sqlite-fallback-test");
    }
  });
});
