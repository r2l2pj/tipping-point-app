# u15-smokefix

Two real-GEE failures in `src/lib/ee.smoke.test.ts` fixed on `unit/u15-smokefix`.

## Changes (src/lib/ee.smoke.test.ts only)

1. **IMERG reachability** — `NASA/GPM_L3/IMERG_V07` is an ImageCollection, not an
   Image, so `ee.Image(...).getInfo` failed server-side. The reachability loop now
   carries a `kind` per asset: NASADEM stays `ee.Image(asset)`; IMERG uses
   `ee.ImageCollection(asset).limit(1).first()`. `src/types/earthengine.d.ts`
   declares `ee.Image` only and `ee.ImageCollection` resolves to `unknown` via the
   index signature, so a test-local `EeImageCollectionFactory` structural type was
   added (the d.ts is outside this unit's file scope). Same `withTimeout` +
   `imageInfo` wrappers and assertion style kept.

2. **Metrics result shape** — after the manifest+GEE merge a result may be
   `sources: ['manifest']` with `data_date: null`. The result branch now asserts
   `typeof metrics === 'object'`, `Array.isArray(sources) && sources.length > 0`,
   `typeof data_date === 'string'` only when sources include `'gee'`, and allows
   `null` otherwise. `console.log` now prints `sources=`. `MetricsNotFoundError`
   remains the tolerated class.

Layers probe `ids=none` log left unchanged per instructions.

## Commands run

- `bun install --frozen-lockfile` — ok, 762 packages.
- `bun test` — 282 pass, 6 skip (live smoke skips without creds, as expected), 0 fail.
- `bunx eslint src/lib/ee.smoke.test.ts` — clean (0 problems).
- `bunx tsc --noEmit` — no errors in `ee.smoke.test.ts` (two pre-existing errors in
  unrelated files: `RouteContext`/`LayoutProps`, untouched).

## Not verified here

Live path cannot run without GEE creds; the lead runs it post-merge. Written so the
real run passes given NASADEM getInfo resolves, IMERG first-image resolves, and
metrics for `rs_2024` may return manifest-only (`data_date: null`).
