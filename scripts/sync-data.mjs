// Copies published artifacts from the sibling data repo into public/data/.
// Contract: tipping-point-data/data/SCHEMA.md. raw/ is never copied.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const SRC = process.env.DATA_REPO
  ? path.join(process.env.DATA_REPO, "data")
  : path.resolve(import.meta.dirname, "../../tipping-point-data/data");
const DEST = path.resolve(import.meta.dirname, "../public/data");

if (!existsSync(SRC)) {
  console.warn(`sync-data: ${SRC} not found — skipping (set DATA_REPO to override)`);
  process.exit(0);
}
mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true, filter: (src) => !src.includes(`${path.sep}raw`) });
console.log(`sync-data: ${SRC} -> ${DEST}`);
