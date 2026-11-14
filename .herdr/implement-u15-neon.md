# u15-neon implementation

Branch: `unit/u15-neon`; base: `0461363`. Verification below ran on the final code/test working tree based on that SHA, before the commit containing this report.

## Changes

- Added `src/lib/telegram/neon-store.ts`: dependency-free fetch adapter implementing the unchanged SubscriberStore contract. POSTs JSON `{query,params}` to the DATABASE_URL hostname's HTTPS `/sql` endpoint, supplies the complete string only in `Neon-Connection-String`, leaves raw-text/array modes unset, and applies `AbortSignal.timeout(5000)` to each request.
- SELECT maps numeric/string scalars defensively; nullable required numeric fields become zero and nullable optional strings are omitted. Consent remains boolean. SQL `EXTRACT(EPOCH FROM last_alert_ts)::float*1000` returns milliseconds; writes use `to_timestamp($6/1000.0)` with epoch milliseconds as the sixth parameter. The store does not round coordinates.
- INSERT/ON CONFLICT replaces all seven mutable fields with eight bound values including the chat id. Absent optional strings become SQL null. DELETE binds the chat id and accepts successful empty rows for nonexistent records.
- Errors carry the `neon store: <status> <message>` prefix. Fixed diagnostics deliberately do not echo server error bodies, fetch exception text, credentials, or subscriber parameter values.
- Updated `deps.ts` to use Neon when DATABASE_URL is valid and the singleton memory store when absent/malformed. Memoization remains unchanged. No GCP credentials are used for subscriber persistence.
- Added the exact subscribers table and RLS activation in `db/schema.sql`, including the requested table-owner/RLS comment. No migration was executed against a live database.
- Added 17 fake-fetch tests covering transport, row conversion, missing rows, nulls, all upsert parameters and updates, SQL injection-shaped input, optional values, deletion, errors/redaction, malformed URLs, and isolated fresh deps modules for absent/malformed/configured env plus memoization.
- Deleted `src/lib/telegram/firestore-store.ts` after confirming no remaining importers.
- Retained `src/lib/firestore-rest.ts`: `src/lib/telegram/firestore-rest.test.ts` still imports it directly. This follows the explicit importer exception; existing test coverage remains intact. No existing tests import FirestoreStore itself.
- No dependencies, credentials, routes, bot code, store contracts, public assets, or unrelated files changed. Existing comments were preserved.

## Commands and results

- First command: `bun install --frozen-lockfile` — exit 0; `762 packages installed`; package.json and bun.lock unchanged.
- Inspected contracts, env wiring, Firestore implementations, Telegram test files, package scripts, and searched all Firestore importers using file tools.
- `git status --short`, `git branch --show-current`, `git log -3 --oneline` — confirmed initially clean scoped branch at base `0461363`.
- `git rm src/lib/telegram/firestore-store.ts` — removed only the explicitly authorized obsolete adapter; created `db/` for the requested schema.
- `bun test src/lib/telegram/neon-store.test.ts` — exit 0: `17 pass`, `0 fail`, `57 expect() calls`.
- Final `bun test` — exit 0: `263 pass`, `6 skip`, `0 fail`, `779 expect() calls`; `Ran 269 tests across 17 files`. Six existing live-GEE smoke tests skipped without credentials. The brief's stated baseline of 271 does not match this base checkout: the final suite has 17 new tests and no removed tests (246 existing passing tests plus 17 new passing tests).
- `bun run build` (twice, including after final test edits) — exit 0. Expected prebuild warning: `sync-data: .../tipping-point-data/data not found — skipping (set DATA_REPO to override)`. Final output: `Compiled successfully`, `Finished TypeScript`, and `Generating static pages ... (13/13)`.
- `bun run lint` — exit 0: `1100 problems (0 errors, 1100 warnings)`, all in existing `public/maplibre-gl-worker.js` and `src/types/earthengine.d.ts`.
- `bun run lint src/lib/telegram/neon-store.ts src/lib/telegram/neon-store.test.ts src/lib/telegram/deps.ts` — exit 0, no warnings/errors.
- `git diff --check` — exit 0.
- Used project `todo` logging and session task tracking. No helper agents, model changes, live database calls, or push.

## Limits

The Neon wire contract is exercised only with injected fake fetch responses as requested; no credentials were supplied and no live Neon/schema execution is claimed. SQL schema enables RLS without policies and assumes the app connects as the table owner, as specified.
