# u15-neon implementation — complete (L11/L12b/L12c)

Branch `unit/u15-neon`, base `0461363`. Initial Neon-only commit: `dad9c1a`. L12c extension is the subsequent commit containing this final report. Final verification ran on that extension's exact code/test working tree before committing. No push.

## Changes

- Added NeonStore over plain injected fetch: HTTPS `/sql` from DATABASE_URL hostname, complete URL only in Neon-Connection-String header, JSON `{query,params}`, default object rows, 5000 ms timeout, parameterized get/upsert/delete. Errors use fixed `neon store: <status> <message>` diagnostics without echoing server responses, credentials, parameters or fetch exception text.
- Added SqliteStore using real SQLite with no new dependencies. Lazy initialization creates parent directories, opens the database, and executes the one portable `db/schema.sql` relative to process.cwd(). Shared prepare/run/get methods implement full-field parameterized upsert, get and delete. Concurrent initial operations share one open promise.
- Final SQLite runtime loader is the explicitly approved fallback: lazy `createRequire(path.join(process.cwd(), 'package.json'))('node:sqlite')` inside the initialization promise; deps catches open failures. Bun 1.4.4's node:sqlite compatibility subsumes the original requirement to switch to bun:sqlite under Bun. Node 22 provides node:sqlite natively. Literal dynamic import was attempted first but @types/node 20 lacks node:sqlite declarations, causing build TS2307; no dependency/type/config changes were needed with the approved fallback.
- Both backends keep the unchanged Subscriber/SubscriberStore interface. Numeric row fields coerce defensively; null required numerics become zero, null optional strings are omitted. Consent is boolean in JS, bound as 1/0 in SQLite. JS last_alert_ts milliseconds become ISO timestamp strings on writes and ISO strings become milliseconds on reads in BOTH stores. Coordinate rounding remains exclusively in bot.ts; stores preserve passed precision.
- depsFromEnv remains synchronous and memoized. PostgreSQL URLs choose Neon; sqlite:<path> chooses SQLite; unset chooses `.data/tipping-point.sqlite`. SQLite opens lazily behind async store operations; a failed open warns once and selects the singleton memory fallback for all subsequent operations. Malformed non-SQLite URLs retain the originally requested memory fallback.
- db/schema.sql is portable: requested columns/type names, CURRENT_TIMESTAMP default, no active Neon-only statement. RLS activation and owner/no-policy explanation are a commented Neon provisioning section.
- Appended exactly `.data/` to .gitignore.
- Added 17 Neon fake-fetch tests and 7 real SQLite in-memory tests. They cover all-field mapping, timestamp conversion, false/zero/nulls, missing rows, all upsert fields, deletion, hostile ids/strings, coordinate precision, transport/auth headers, safe failures, malformed URLs, env selection and SQLite open-failure fallback.
- Removed unreferenced FirestoreStore wrapper. Retained src/lib/firestore-rest.ts because existing src/lib/telegram/firestore-rest.test.ts still imports it directly (explicit importer exception). No existing tests import FirestoreStore directly; all existing tests remain.
- No changes to bot.ts, routes, Subscriber contracts, dependencies/lockfile, public assets, or unrelated files. No credentials, live Neon calls, helper agents or model changes.

## Verification commands/results

Initial setup and Neon-only commit:

- FIRST `bun install --frozen-lockfile`: exit 0, `762 packages installed`; package.json/bun.lock unchanged.
- File tools inspected Subscriber contracts, env wiring, both Firestore files, all existing Telegram tests and scripts; importer search confirmed the retained REST helper's test importer.
- `git status --short`, `git branch --show-current`, `git log -3 --oneline`: clean start on expected branch/base.
- `git rm src/lib/telegram/firestore-store.ts`: removed authorized dead wrapper.
- Initial Neon-only `bun test`: 263 pass / 6 skip / 0 fail, 269 total. Initial build/scoped lint/diff check passed.
- `bun run lint`: exit 0; `1100 problems (0 errors, 1100 warnings)`, exclusively existing public/maplibre-gl-worker.js and src/types/earthengine.d.ts. No changed-file warnings.
- Initial staging named the already staged/deleted wrapper and exited 128; retry without that path succeeded. Initial commit dad9c1a has required Devin trailers.

Final L12c code (based on dad9c1a):

- `bun test src/lib/telegram/neon-store.test.ts src/lib/telegram/sqlite-store.test.ts`: 24 pass / 0 fail, 72 assertions (also exercised the intermediate literal-import implementation under Bun).
- Final `bun test`: exit 0; `270 pass`, `6 skip`, `0 fail`, `794 expect() calls`; `Ran 276 tests across 18 files`. Six pre-existing live-GEE tests skip without credentials. Brief's 271 baseline does not match this checkout: 246 existing passing tests + 24 added passing tests, no existing tests removed.
- Final `bun run build`: exit 0; sync:data expected warn-skip (`.../tipping-point-data/data not found — skipping`), `Compiled successfully`, `Finished TypeScript`, generated 13/13 pages.
- Final `bun run lint src/lib/telegram/neon-store.ts src/lib/telegram/neon-store.test.ts src/lib/telegram/sqlite-store.ts src/lib/telegram/sqlite-store.test.ts src/lib/telegram/deps.ts`: exit 0, no diagnostics.
- `git diff --check`: exit 0.
- `node --version`: v22.23.3; `bun --version`: 1.4.4.
- Native Node source smoke via `node --experimental-transform-types --input-type=module -e '<import SqliteStore; assert in-memory roundtrip/upsert/delete>'`: passed, with expected experimental warnings.

### Production-artifact proof and resolved blocker

The initial runtime-switched `import(moduleName)` passed tests/build but the compiled Next Node route warned and fell back to memory. Stopped and reported to t69 after that real attempt. Lead authorized a single literal node:sqlite import, or lazy createRequire fallback. Literal import passed Bun tests but Next TypeScript reported `TS2307: Cannot find module 'node:sqlite' or its corresponding type declarations`. Approved lazy require resolved both issues. No magic comments, new packages or config changes.

Final compiled-route proof used this exact command (all Telegram calls stubbed, real SQLite):

```sh
node --no-warnings --input-type=commonjs -e 'const assert = require("node:assert/strict"); const sqlite=require("node:sqlite"); const Native=sqlite.DatabaseSync; let db; sqlite.DatabaseSync=class extends Native {constructor(...args){super(...args);db=this;}}; process.env.TELEGRAM_SECRET="test"; process.env.TELEGRAM_TOKEN="fake"; process.env.DATABASE_URL="sqlite::memory:"; global.fetch=async()=>Response.json({ok:true}); const warnings=[]; const errors=[]; console.warn=(...args)=>warnings.push(args); console.error=(...args)=>errors.push(args); const {POST}=require("./.next/server/app/api/telegram/route.js").routeModule.userland; (async()=>{const response=await POST(new Request("http://localhost/api/telegram",{method:"POST",headers:{"x-telegram-bot-api-secret-token":"test"},body:JSON.stringify({message:{chat:{id:123},location:{latitude:-29.24123,longitude:-51.87987}}})})); assert.equal(response.status,200); assert.deepEqual(errors,[]); assert.deepEqual(warnings,[]); assert.ok(db instanceof Native); const row=db.prepare("SELECT chat_id,lat,lon,consent,last_alert_ts FROM subscribers WHERE chat_id = ?").get("123"); assert.equal(row.chat_id,"123"); assert.equal(row.lat,-29.24); assert.equal(row.lon,-51.88); assert.equal(row.consent,1); assert.ok(Number.isFinite(Date.parse(row.last_alert_ts))); console.log("Built Node route SQLite registration passed: real row verified, no memory fallback"); db.close();})().catch(err=>{process.stderr.write(String(err));process.exitCode=1;});'
```

Exit 0: `Built Node route SQLite registration passed: real row verified, no memory fallback`. A first run without --no-warnings caught Node's expected experimental SQLite warning via the console.error interception; reran suppressing that runtime warning, not application errors. DatabaseSync subclass delegates to the real native database and exposes it solely to assert the actual persisted row. This proves the compiled route uses SQLite rather than merely answering 200 after a fallback.

## Limits

No live Neon credentials or schema provisioning were supplied/requested; Neon wire behavior uses fake fetch only. SQLite filesystem durability is local to its deployment; writable local storage is required, otherwise the specified warning/memory fallback applies. RLS activation is intentionally commented and must be executed during Neon provisioning by the table owner.
