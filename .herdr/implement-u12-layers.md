# u12-layers — L8 layer-metadata half (GET /api/layers)

Branch: unit/u12-layers, base 35b6c18, commit 3b87ce0. Cred-blocked: no creds,
no new deps, fake-ee tests only.

## Files
- src/lib/ee-layers.ts (new) — probe lib. `getLayerMeta(caseId, {layer?, ee?,
  manifest?})`: canonicalizes via canonicalCaseId, checks credentialEnv()
  (LayersCredsError), resolves assetRoot = GEE_ASSET_ROOT ??
  `projects/${GEE_PROJECT}/assets/tipping-point`. Per PROBE_LAYERS id: getInfo
  on `<id>_series` first, then bare `<id>` (5s per-asset timeout via local
  withTimeout, Promise.allSettled → failures omitted). Band ids YYYYMMDD
  normalized to YYYY-MM-DD, sorted asc; props → data_date ?? updated_at,
  updated_at. Manifest merge: cases[canonical].layers[] entries with non-null
  `asset` get one getInfo each; declared:true + asset on success or declared
  date on failure; enriches an already-probed id rather than duplicating.
  Module cache keyed canonical, TTL 15min; layer= single probes bypass cache
  and manifest merge. ee typed structurally (EeLike/EeImageLike); no ee-tiles
  import. createLayerService(ee, opts) is the fake-ee test seam.
- src/app/api/layers/route.ts (new) — GET only. 400 missing `case`; 503
  {error:"gee unavailable",reason} when credentialEnv() null or
  LayersCredsError; 200 {case, canonical, layers[]}; 502 {error:"gee layers
  failed",reason} on other ee init/compute failures.
- src/lib/ee-layers.test.ts (new) — 12 tests, fake ee injected, mock.module
  for the route-200 case.

## Contract update applied (mid-task hc from t69)
Series-first probing (`<id>_series` → bare `<id>`), YYYYMMDD→YYYY-MM-DD
normalization, manifest-declared asset merge ({id, dates, asset,
declared:true}), declared-asset id resolution: `projects/...` as-is, paths
with `/` under root, bare names under the case dir.

## Commands + results
- `bun install --frozen-lockfile` — 762 pkgs, ok.
- `bun test src/lib/ee-layers.test.ts` — 12 pass / 0 fail.
- `bun test` (full) — 114 pass / 0 fail, no regressions.
- `bun run lint src/lib/ee-layers.ts src/lib/ee-layers.test.ts
  src/app/api/layers/route.ts` — clean.
- `bun run build` — green; sync:data warn-skips (no data repo in worktree,
  expected); /api/layers registered as dynamic route.

## Notes
- Reconcile comments left for merge: PROBE_LAYERS vs LAYER_VIS registry,
  assetRoot vs ee-tiles resolveAsset.
- `?layer=<id>` probes only that asset pair; declared-only ids (e.g.
  tpi_slide_d0) still resolve via the bare-name fallback.
