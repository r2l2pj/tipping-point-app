// Server-side loader for the static data contract (public/data/).
// Files are synced from r2l2pj/tipping-point-data by `bun run sync:data`.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { EventManifest, EventMetrics, EventsIndex } from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

async function readJson<T>(...parts: string[]): Promise<T> {
  const raw = await readFile(path.join(DATA_DIR, ...parts), "utf-8");
  return JSON.parse(raw) as T;
}

export const getEventsIndex = () => readJson<EventsIndex>("events.json");
export const getManifest = (id: string) => readJson<EventManifest>(id, "manifest.json");
export const getMetrics = (id: string) => readJson<EventMetrics>(id, "metrics.json");
