import { SqliteStore } from "./sqlite-store";
import memoryStore from "./store";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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

  test("enables WAL and a busy timeout for the shared VPS database", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sqlite-store-"));
    const filename = path.join(directory, "subscribers.sqlite");
    const store = new SqliteStore(filename);
    let reader: { close(): void; prepare(sql: string): { get(): Record<string, unknown> } } | undefined;
    try {
      await store.open();
      const require = createRequire(path.join(process.cwd(), "package.json"));
      const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (filename: string) => typeof reader & object };
      reader = new DatabaseSync(filename);
      expect(reader.prepare("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
      const connection = await (store as unknown as {
        database: Promise<{ prepare(sql: string): { get(): Record<string, unknown> }; close(): void }>;
      }).database;
      expect(connection.prepare("PRAGMA busy_timeout").get()).toEqual({ timeout: 5000 });
    } finally {
      reader?.close();
      const connection = await (store as unknown as { database: Promise<{ close(): void }> | null }).database;
      connection?.close();
      await rm(directory, { recursive: true, force: true });
    }
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

  test("configured SQLite fails closed when the database cannot open", async () => {
    const saved = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = "sqlite:/dev/null/cannot-open.sqlite";
      const modulePath = "./deps.ts?sqlite-test=failure";
      const { depsFromEnv } = await import(modulePath);
      const { store } = depsFromEnv();
      await expect(store.set("sqlite-fallback-test", subscriber)).rejects.toThrow("telegram store: configured SQLite unavailable");
      expect(await memoryStore.get("sqlite-fallback-test")).toBeNull();
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = saved;
    }
  });
});
