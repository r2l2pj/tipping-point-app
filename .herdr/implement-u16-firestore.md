# u16-firestore implementation

Branch: `unit/u16-firestore`. Base verified: `054afef` (main HEAD at task start). Evidence below ran on the resulting source diff against that SHA, before this report-only addition and commit.

## Changes

- Deleted `src/lib/firestore-rest.ts`: superseded service-account JWT/OAuth and Firestore REST client.
- Deleted `src/lib/telegram/firestore-rest.test.ts`: all tests exercised removed JWT signing/cache, REST URL/auth/method/status handling, or Firestore-specific document field codecs. None exercised SubscriberStore directly or warranted porting. Existing SQLite tests cover missing subscribers, complete scalar round trips, optional fields, false/zero, upserts, deletion, normalized IDs, and parameterization.
- Updated only the stale MemoryStore comment in `src/lib/telegram/store.ts`: process-local fallback, with durable NeonStore/SqliteStore selected by DATABASE_URL in deps.ts.
- Lead t69 explicitly extended scope to `src/lib/telegram/deps.ts`; updated only its stale memoization comment to name the current stores.
- No dependencies added; no runtime behavior changed outside deleting the unreferenced client. No push.

## Commands and results

- First command: `bun install --frozen-lockfile` — exit 0, 762 packages installed; lockfile unchanged.
- Read all four mandated files first. Source search for `firestore|serviceAccountToken|toFsFields|fromFsFields` found no consumer outside the deleted client/test (only stale comments in store/deps).
- `git status --short`, `git branch --show-current`, `git log -3 --oneline` — initially clean, correct branch, base 054afef.
- `git rm -- src/lib/firestore-rest.ts src/lib/telegram/firestore-rest.test.ts` — exit 0; deletions explicitly authorized by conductor.
- Case-insensitive source grep via search tool, pattern `firestore`, path `src/` after changes — `No matches found`.
- `bun test` — exit 0: `307 pass`, `6 skip`, `0 fail`, `923 expect() calls`, `Ran 313 tests across 18 files.` Skips are existing live GEE smoke tests requiring credentials.
- `bun run build` — exit 0: `Compiled successfully`, TypeScript finished, `Generating static pages ... (14/14)`. Expected prebuild warning: sibling tipping-point-data/data not found, sync-data skipped (set DATA_REPO to override).
- `bun run lint` — exit 0, but not warning-free: `1100 problems (0 errors, 1100 warnings)` in unchanged vendored `public/maplibre-gl-worker.js` and `src/types/earthengine.d.ts`. Reported caveat to t69; no out-of-scope cleanup attempted.
- `bunx --no-install eslint src/lib/telegram/store.ts src/lib/telegram/deps.ts` — exit 0, no diagnostics.
- `git diff --check` — exit 0, no whitespace issues. Reviewed comment-only edits and deletion diff/stat; only approved source paths changed.
- Herdr request log checked on; project todo added and verification tracked. Report uses this unit-specific path to avoid overwriting other implementation reports.

## Acceptance caveat

Full tests and build are green. Full lint succeeds with zero errors, but the requested warning-free lint is blocked by 1100 warnings in untouched, out-of-scope files. Changed files lint cleanly. No remaining Firestore references exist under src/.
