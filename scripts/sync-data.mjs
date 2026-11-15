// Copies published artifacts from the sibling data repo into public/data/.
// Contract: tipping-point-data/data/SCHEMA.md. raw/, static/ and heavy
// source files are never copied (scripts/sync-filter.mjs).
// now/ is copied only when its manifest's updated_at is non-null — the
// pipeline writes that file LAST, so a null/absent one means a run is in
// progress (or no live bundle exists yet).
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { keepForPublic } from "./sync-filter.mjs";

const SRC = process.env.DATA_REPO
  ? path.join(process.env.DATA_REPO, "data")
  : path.resolve(import.meta.dirname, "../../tipping-point-data/data");
const DEST = path.resolve(import.meta.dirname, "../public/data");
const NOW = path.join(SRC, "now");

if (!existsSync(SRC)) {
  console.warn(`sync-data: ${SRC} not found — skipping (set DATA_REPO to override)`);
  process.exit(0);
}
mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, {
  recursive: true,
  filter: (src) =>
    keepForPublic(src, SRC) &&
    src !== NOW &&
    !src.startsWith(NOW + path.sep),
});
console.log(`sync-data: ${SRC} -> ${DEST}`);

const nowManifest = path.join(NOW, "manifest.json");
if (!existsSync(nowManifest)) {
  console.log("sync-data: no now/manifest.json — live bundle skipped");
} else {
  const { updated_at } = JSON.parse(readFileSync(nowManifest, "utf-8"));
  if (updated_at == null) {
    console.log("sync-data: now/ updated_at is null (run in progress) — skipped");
  } else {
    cpSync(NOW, path.join(DEST, "now"), { recursive: true, filter: (src) => keepForPublic(src, NOW) });
    console.log("sync-data: now/ bundle synced");
  }
}
