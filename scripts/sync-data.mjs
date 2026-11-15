// Copies published artifacts from the sibling data repo (origin/fallback,
// else its working tree) into public/data/.
// Contract: tipping-point-data/data/SCHEMA.md. raw/, static/ and heavy
// source files are never copied (scripts/sync-filter.mjs).
// now/ is copied only when its manifest's updated_at is non-null — the
// pipeline writes that file LAST, so a null/absent one means a run is in
// progress (or no live bundle exists yet).
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { keepForPublic, neededTifs } from "./sync-filter.mjs";

const REPO = process.env.DATA_REPO ?? path.resolve(import.meta.dirname, "../../tipping-point-data");

// The data repo's working tree can be far behind what is published (Lucas's
// box: 225 commits, no Uruguaiana case). Take data/ from origin/fallback —
// the branch production reads — and use the working tree only offline or
// with SYNC_LOCAL=1. The archive skips heavy files (same rules as the filter).
function fromFallback() {
  if (process.env.SYNC_LOCAL || !existsSync(path.join(REPO, ".git"))) return undefined;
  const stage = path.resolve(import.meta.dirname, "../node_modules/.cache/sync-data");
  try {
    execSync("git fetch -q origin fallback", { cwd: REPO, stdio: "ignore", timeout: 60_000 });
    rmSync(stage, { recursive: true, force: true });
    mkdirSync(stage, { recursive: true });
    const ex = ["*.tif", "*.tiff", "*.hgt", "*.zip", "*.h5", "*.he5", "*.hdf", "*.nc", "*.nc4", "*.grib2", "*.grb2", "*.npz"]
      .map((g) => `':(exclude,glob)data/**/${g}'`).concat(["':(exclude,glob)data/**/raw/**'", "':(exclude,glob)data/**/static/**'"]);
    execSync(`git archive --format=tar origin/fallback -- data ${ex.join(" ")} | tar -x -C '${stage}'`, { cwd: REPO, stdio: ["ignore", "ignore", "inherit"], timeout: 120_000, shell: "/bin/sh" });
    const sha = execSync("git rev-parse --short origin/fallback", { cwd: REPO }).toString().trim();
    console.log(`sync-data: data from origin/fallback ${sha}`);
    return path.join(stage, "data");
  } catch (e) {
    console.warn(`sync-data: origin/fallback unavailable (${String(e).split("\n")[0]}) — using the working tree`);
    return undefined;
  }
}

const SRC = fromFallback() ?? path.join(REPO, "data");
const DEST = path.resolve(import.meta.dirname, "../public/data");
const NOW = path.join(SRC, "now");

if (!existsSync(SRC)) {
  console.warn(`sync-data: ${SRC} not found — skipping (set DATA_REPO to override)`);
  process.exit(0);
}
mkdirSync(DEST, { recursive: true });
const KEEP_TIF = neededTifs(SRC);
cpSync(SRC, DEST, {
  recursive: true,
  filter: (src) =>
    keepForPublic(src, SRC, KEEP_TIF) &&
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
    cpSync(NOW, path.join(DEST, "now"), { recursive: true, filter: (src) => keepForPublic(src, NOW, KEEP_TIF) });
    console.log("sync-data: now/ bundle synced");
  }
}
