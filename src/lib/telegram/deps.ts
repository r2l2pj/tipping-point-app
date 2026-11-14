// Builds BotDeps from env. Memoized module-level so the MemoryStore (and the
// Firestore token cache) persist across warm invocations of the route.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BotDeps, Simular } from "./bot";
import { NeonStore } from "./neon-store";
import { SqliteStore } from "./sqlite-store";
import memoryStore from "./store";

const send: BotDeps["send"] = async (chatId, text, replyMarkup) => {
  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!res.ok) throw new Error(`telegram sendMessage: HTTP ${res.status}`);
};

// Order: TELEGRAM_SIMULAR_URL (hosted artifact) → bundled public/data files.
const fetchSimular: BotDeps["fetchSimular"] = async () => {
  const url = process.env.TELEGRAM_SIMULAR_URL;
  if (url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`simular fetch: HTTP ${res.status}`);
    return (await res.json()) as Simular;
  }
  const dataDir = path.join(process.cwd(), "public", "data");
  for (const rel of [path.join("rs_2024", "simular.json"), "simular.json"]) {
    try {
      return JSON.parse(await readFile(path.join(dataDir, rel), "utf-8")) as Simular;
    } catch {
      // missing or malformed — try the next fallback
    }
  }
  throw new Error("no simular.json source available");
};

let deps: BotDeps | null = null;

export function depsFromEnv(): BotDeps {
  if (!deps) {
    let store: BotDeps["store"] = memoryStore;
    try {
      const url = process.env.DATABASE_URL;
      if (!url || url.startsWith("sqlite:")) {
        const sqlite = new SqliteStore(url ? url.slice(7) : ".data/tipping-point.sqlite");
        let selected: Promise<BotDeps["store"]> | undefined;
        const select = () => selected ??= sqlite.open().then(() => sqlite).catch(() => {
          console.warn("telegram store: SQLite open failed; using process-local memory");
          return memoryStore;
        });
        store = {
          get: async (chatId) => (await select()).get(chatId),
          set: async (chatId, sub) => (await select()).set(chatId, sub),
          delete: async (chatId) => (await select()).delete(chatId),
        };
      } else {
        store = new NeonStore(url);
      }
    } catch {
      store = memoryStore;
    }
    deps = { send, store, fetchSimular };
  }
  return deps;
}
