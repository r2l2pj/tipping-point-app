# u15-maxduration implementation

Branch: `unit/u15-maxduration`. Base: `0461363`.
Verification ran on the working-tree route changes from that base, committed with this report.

## Changes

Added only a literal `export const maxDuration = <seconds>;` and a separating blank line after imports in each existing route. Handler logic, comments, dependencies, and runtime selection are unchanged. No route previously exported maxDuration or runtime. No point route was created or touched.

| Route file | maxDuration (seconds) |
| --- | ---: |
| src/app/api/events/route.ts | 30 |
| src/app/api/events/[id]/manifest/route.ts | 30 |
| src/app/api/ee/status/route.ts | 60 |
| src/app/api/tiles/route.ts | 60 |
| src/app/api/layers/route.ts | 60 |
| src/app/api/numbers/route.ts | 60 |
| src/app/api/metrics/route.ts | 60 |
| src/app/api/health/route.ts | 60 |
| src/app/api/telegram/route.ts | 30 |

All nine current API route handlers are configured; none exceeds the specified Hobby limit of 60 seconds.

## Next.js documentation checked before editing

First read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`: route handlers use route.js/ts inside app, export HTTP-method functions, and are not cached by default. It does not document maxDuration or runtime exports.

Then read the installed segment-config references under `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/`:
- `maxDuration.md` explicitly documents `export const maxDuration = 5` for route.ts, in seconds, consumed by deployment platforms from the build output. No alternate name or runtime requirement is given.
- `runtime.md` documents Node.js as default and Edge as deprecated. With Cache Components enabled, explicit runtime exports should be removed. None existed here, and none was added.

## Commands and results

- `bun install --frozen-lockfile` (first shell command): exit 0; 762 packages installed, no manifest/lockfile changes.
- `git status --short && git branch --show-current && todo log`: initially clean, correct branch, request logging on.
- `bun test`: exit 0; `246 pass`, `6 skip`, `0 fail`, `722 expect() calls`, `Ran 252 tests across 16 files`. Skips are existing live-GEE tests requiring credentials. Actual suite count differs from the approximate 271 in the brief.
- `bun run build`: exit 0; compiled successfully, TypeScript passed, 13/13 static pages generated; all nine API routes listed as dynamic. Expected warning: `sync-data: .../tipping-point-data/data not found — skipping (set DATA_REPO to override)`.
- `bun run lint src/app/api/events/route.ts 'src/app/api/events/[id]/manifest/route.ts' src/app/api/ee/status/route.ts src/app/api/tiles/route.ts src/app/api/layers/route.ts src/app/api/numbers/route.ts src/app/api/metrics/route.ts src/app/api/health/route.ts src/app/api/telegram/route.ts`: exit 0, no diagnostics.
- `git diff --check && git diff && git log -5 --oneline`: exit 0; diff contains exactly the nine requested literal exports and blank lines.
- Read generated `.next/server/functions-config-manifest.json`: all nine route entries have exactly the values in the table above. This verifies Next.js emitted the deployment configuration, not merely accepted the source syntax.

No helpers, no new dependencies, no push. Only the nine allowed route files and this report are included in the commit.
