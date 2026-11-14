// Copies published artifacts from the sibling data repo into public/data/.
// Contract: tipping-point-data/data/SCHEMA.md. raw/ is never copied.
// now/ is copied only when its manifest's updated_at is non-null — the
// pipeline writes that file LAST, so a null/absent one means a run is in
// progress (or no live bundle exists yet).
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

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

// Snapshot the existing bundled metrics before the copy overwrites it —
// metrics.json is merged, not replaced: the app ships flagged placeholder
// keys (lead_time_assumptions.quality: "placeholder", plus cases the pipeline
// has not emitted yet — e.g. rs_2024 metrics) that must survive every sync.
// Repo values always win per key; app-only cases and keys are preserved.
const METRICS = "metrics.json";
const repoMetrics = path.join(SRC, METRICS);
const destMetrics = path.join(DEST, METRICS);
const appMetrics = existsSync(destMetrics)
  ? readFileSync(destMetrics, "utf-8")
  : undefined;

cpSync(SRC, DEST, {
  recursive: true,
  filter: (src) =>
    !src.includes(`${path.sep}raw`) &&
    src !== NOW &&
    !src.startsWith(NOW + path.sep),
});
console.log(`sync-data: ${SRC} -> ${DEST}`);

if (existsSync(repoMetrics) && appMetrics !== undefined) {
  const repo = JSON.parse(readFileSync(repoMetrics, "utf-8"));
  const app = JSON.parse(appMetrics);
  const cases = { ...app.cases };
  for (const [id, m] of Object.entries(repo.cases ?? {})) {
    cases[id] = { ...(app.cases?.[id] ?? {}), ...m };
  }
  writeFileSync(destMetrics, JSON.stringify({ ...app, ...repo, cases }, null, 2) + "\n");
  console.log("sync-data: metrics.json merged (repo wins, app placeholders kept)");
}

const nowManifest = path.join(NOW, "manifest.json");
if (!existsSync(nowManifest)) {
  console.log("sync-data: no now/manifest.json — live bundle skipped");
} else {
  const { updated_at } = JSON.parse(readFileSync(nowManifest, "utf-8"));
  if (updated_at == null) {
    console.log("sync-data: now/ updated_at is null (run in progress) — skipped");
  } else {
    cpSync(NOW, path.join(DEST, "now"), { recursive: true });
    console.log("sync-data: now/ bundle synced");
  }
}
