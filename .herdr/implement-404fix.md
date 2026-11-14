# unit/404fix — never throw on remote failure

## Changed
- `src/lib/data.ts` — `fetchJson` now returns `Promise<T | undefined>` and can never throw: non-ok HTTP (404/5xx), network error, abort/timeout, and `res.json()` parse failure all return `undefined`. Added `AbortSignal.timeout(4000)` (4s cap so prerender/build can't stall on a dead remote). Kept `'use cache'`/`cacheLife` and readData's `.catch(() => undefined)` as belt-and-suspenders.
- `src/lib/data.test.ts` — new describe `"remote returns 404 for everything"`: `DATA_BASE_URL` set to the fixture base with an empty files map (every remote read 404s). Asserts `getRootManifest()` resolves with bundled manifest (rs_2024, wa_2025, now), `getCaseBundle('rs-2024-05', …)` returns bundled data (`iou 0.64`, `b.fallback === true`), `getMetrics('rs-2024-05')` resolves bundled, and `getCaseBundle('now', …)` does not throw (mode `live`, `fallback === true`).

## Audit
Every remote read funnels through `readData` → `fetchJson` (now non-throwing) → `readFs` under `public/data`. `getEventsIndex`, `getManifest`, `getMetrics`, `getSeries`, `getAlerts`, `getCaseBundle` only throw via `must()`/explicit not-found errors after both remote and fs returned `undefined`.

## Proof
- `bun test` — 318 pass, 0 fail, 6 skip (live GEE smoke, creds absent).
- `DATA_BASE_URL=http://127.0.0.1:1 bun run build` — exit 0; `/alerts` prerendered (◐, 1m revalidate).

## Expanded acceptance (conductor, on e3c22ce = fix rebased onto 3bb8c8e)
Fresh worktree `/tmp/404fix-accept` at e3c22ce, `bun install --frozen-lockfile` (762 packages, lockfile clean):
- (a) `DATA_REPO=/nonexistent bun run build` — **exit 0**, 14/14 static pages, `/alerts` ◐ prerendered.
- (b) `DATA_REPO=/nonexistent DATA_BASE_URL=https://example.invalid/ bun run build` — **exit 0**, 14/14, `/alerts` ◐ prerendered.
- Test coverage extended in the "remote returns 404 for everything" block: asserts bundled `now` summary (11.4), alerts (3 candidates), criticalAreas, series (9 days), and that remote hits included `metrics.json`, `now/metrics.json`, `now/series/imerg_smap_daily.json`, `now/summary.json`, `now/alerts.json`, `now/geojson/*` — each miss served from bundled public/data or counted absent.
