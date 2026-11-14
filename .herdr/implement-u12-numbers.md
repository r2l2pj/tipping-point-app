# U12 — GET /api/numbers (ruling L8, numbers half)

## What changed

- `src/lib/ee-numbers.ts` (new) — `createNumbersService(eeLike, opts)` injectable
  service + credentialed `getNumbers(caseId, date)`. Structural `EeLike` typing
  (own file; ee-tiles internals and earthengine.d.ts untouched).
  - Asset root: `GEE_ASSET_ROOT` ?? `projects/$GEE_PROJECT/assets/tipping-point`
    (comment left to reconcile with ee-tiles `resolveAsset` after merge).
  - TPI asset: manifest layer entry `tpi_slide` w/ matching `date` and declared
    `asset` first (via `getRootManifest`, injected `opts.manifestLayers` for
    tests), else `${root}/${canonical}/tpi_slide_series`. Band = `YYYYMMDD`
    (dashes stripped), dashed form accepted as fallback.
  - Properties path: `getInfo` → band required (else `NumbersNotFoundError` →
    404); `properties.numbers` dict or flat `km2_critical / people_exposed /
    flooded_km2 / people_flooded` returned verbatim, `source:"properties"`,
    `data_date` from props `data_date` ?? `updated_at`.
  - Computed path: `select(band).gte(TPI_THRESHOLD)` mask (from `@/lib/tpi`);
    `km2_critical` = `ee.Image.pixelArea()` masked → `reduceRegion(Reducer.sum,
    scale 1000, bestEffort, maxPixels 1e9)` / 1e6; `people_exposed` = population
    masked the same way. Population = `GEE_POP_IMAGE`/`opts.popImage` image else
    latest of `CIESIN/GPWv411/GPW_Population_Count`
    (`.sort("system:time_start", false).first()`).
  - `flood_confirmed`: manifest-declared asset else convention; any `getInfo`
    failure → flooded fields omitted (optional per case). When present,
    `.neq(0)` mask replaces the critical mask for `flooded_km2/people_flooded`.
  - Every EE roundtrip wrapped in `withTimeout` (default 15 s,
    `GEE_NUMBERS_TIMEOUT_MS`) → `NumbersTimeoutError` → 503.
  - Module-level cache keyed `canonical|date`, TTL 10 min; failures
    negative-cached 30 s so a not-yet-published date/asset doesn't cost an EE
    roundtrip per request. `clearNumbersCache()` test hook;
    `setNumbersServiceForTest()` lets route tests drive 404/200 without creds.
- `src/app/api/numbers/route.ts` (new) — GET only; `case` + `date`
  (YYYY-MM-DD) required → 400 naming the param; no creds → 503
  `{error:"gee unavailable",reason}`; `NumbersNotFoundError` → 404;
  `NumbersTimeoutError` → 503 `{error:"gee numbers timeout"}`; other → 502.
  Mirrors `/api/tiles` conventions.
- `src/lib/ee-numbers.test.ts` (new) — 19 tests, fake ee recording chained
  calls (properties verbatim + zero reduceRegion calls, computed gte(0.6)/
  pixelArea/GPW-collection assertions, flood present/absent, manifest asset
  precedence, both band forms, cache + negative-cache, timeout, no-creds,
  route 400/503/404/200).

## Commands run

- `bun install --frozen-lockfile` — 762 packages, ok.
- `bun test src/lib/ee-numbers.test.ts` — 19 pass, 0 fail.
- `bun run lint src/lib/ee-numbers.ts src/lib/ee-numbers.test.ts src/app/api/numbers/route.ts` — clean.
- `bun run build` — green (sync:data warn-skipped, expected in worktree);
  `/api/numbers` listed as dynamic route.

## Notes / deviations

- Amended contract applied: manifest-declared assets first, band name
  `YYYYMMDD`, `flood_confirmed` convention (no `_series`), `_series` suffix on
  the tpi fallback asset.
- Manifest `cases` lookup tries canonical, raw caseId, and the registered
  alias — synced `public/data/manifest.json` keys cases by hyphen event id.
- `ManifestLayer` has no typed `asset` field (types.ts out of scope) — read
  structurally as `ManifestLayer & { asset?: string }`.
- Negative cache covers all error kinds, not just 404s.
