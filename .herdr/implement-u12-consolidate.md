# u12-consolidate — implementation report

Commit `1109b48` on `unit/u12-consolidate` (base `main` 7ee116a). 7 files: 4 lib,
1 route, 2 test files (+0 in ee-numbers.test.ts — swap only needed no test change).

## Changes

**src/lib/ee-shared.ts**
- Added `export function eeAssetRoot(): string` — `GEE_ASSET_ROOT` →
  `projects/$GEE_PROJECT/assets/tipping-point` → `"tipping-point"` (no creds).

**src/lib/ee-tiles.ts**
- `defaultAssetRoot()` removed; service uses `eeAssetRoot()` (imported).
- `resolveAsset` → `resolveAssets` returning a candidate list: manifest asset
  first (wins over both convention candidates); `now` still throws
  `TileNotFoundError` when no manifest asset; else
  `${root}/${canonical}/${layer}_series` then bare `${root}/${canonical}/${layer}`.
- New `loadFirst(candidates)`: tries each candidate's getInfo; falls through only
  on `TileNotFoundError`, rethrows anything else, rethrows the last
  not-found when the list is exhausted. Band-check/`no band` behavior unchanged:
  it is a per-asset 404 after the fallback chain resolves, not a candidate
  fallthrough.

**src/lib/ee-layers.ts**
- `PROBE_LAYERS` literal replaced by `TILE_LAYERS` imported from `./ee-tiles`
  (same 14 ids; probes still default to the full registry).
- Local `assetRoot()` removed; `eeAssetRoot()` — fixes
  `projects/undefined/assets/tipping-point` when `GEE_PROJECT` is unset.
- `getInfo` rejections now go through `mapComputeError` (not-found →
  `TileNotFoundError`, other → `TileServiceError`) so the probe can classify.
- New `export class LayersUnavailableError` (name set).
- `probe()` counts a layer as "answered" when its probe resolves or fails with
  `TileNotFoundError` (asset absent). A layer whose attempts only time out or
  fail with other errors does not answer. `ids.length > 0 && !answered` →
  `LayersUnavailableError`, thrown before the manifest-declared merge (which is
  unchanged and cannot suppress the error or count as an answer). `probe([])` is
  a no-op: no error, declared merge still runs (existing tests rely on this).

**src/app/api/layers/route.ts**
- `LayersUnavailableError` → 503 `{error:"gee unavailable", reason}` (same branch
  as `LayersCredsError`). All other errors remain 502.

**src/lib/ee-numbers.ts**
- `eeAssetRoot` import + `opts.assetRoot ?? eeAssetRoot()` swap only.
  `NumbersTimeoutError`/`withTimeout` untouched — 503 mapping preserved.

## Comments removed (the three "reconcile after merge" notes)

- ee-layers: `// reconcile with LAYER_VIS registry after merge` (above PROBE_LAYERS)
- ee-layers: `// reconcile with ee-tiles resolveAsset after merge` (above assetRoot)
- ee-numbers: `// reconcile with ee-tiles resolveAsset after merge — sibling
  worktree resolves ...` (above defaultAssetRoot)

## New tests (10)

ee-tiles.test.ts (+4, new `missing` fake-ee option for per-asset not-found):
- manifest asset wins over both convention candidates (single `Image` call)
- missing manifest asset → 404, does not fall back to convention candidates
- bare `<layer>` fallback when `<layer>_series` is absent
- non-not-found error on `_series` propagates (no fallthrough)
- (`now` no-manifest → 404 covered by existing tests, unmodified and still passing)

ee-layers.test.ts (+6):
- all probed layers time out → `LayersUnavailableError`
- non-not-found errors on every layer → `LayersUnavailableError`
- all not-found → resolves `[]`
- mixed (found / hang / not-found) → keeps only the found layer
- default root never builds `projects/undefined` (GEE_PROJECT unset → `tipping-point/...`)
- route: `LayersUnavailableError` → 503 `gee unavailable`

## Verification (this worktree)

- `bun install --frozen-lockfile`: 762 packages.
- `bun test`: **195 pass, 0 fail** across 13 files (baseline was 185; +10 new).
- `bun run build`: green; `sync:data` warn-skipped (`tipping-point-data/data not
  found — skipping`), expected in a worktree.
- `npx eslint <7 touched files>`: clean, 0 problems. (Full `bun run lint`: 0
  errors; 1100 pre-existing warnings, all in untouched files.)

## Deviations / notes

1. "Fall through to the next candidate only on TileNotFoundError" was read as
   per-candidate getInfo failures. A `_series` asset that exists but lacks the
   date band still 404s with `no band <date>` rather than falling to the bare
   asset — consistent with the route semantics and the existing band tests.
2. `getInfo` in ee-layers previously rejected with raw `Error`; it now rejects
   with `TileNotFoundError`/`TileServiceError` via `mapComputeError` (required
   to classify answers). No external contract change: the probe still omits
   every non-found layer; errors were never rethrown.
3. `probe()` throws `LayersUnavailableError` itself (guarded by `ids.length > 0`)
   so the declared-only merge path (`probe([])`) is unaffected and `getLayerMeta`
   propagates it without touching the cache.
4. Two adjacent comments that describe pre-merge invariants were left untouched
   per "leave all other comments alone" but are now slightly stale:
   - ee-layers header: "do not import from ee-tiles (sibling unit)" — it now
     imports `TILE_LAYERS` per the spec.
   - ee-tiles header/`resolveAssets` comment: mentions only the `_series`
     convention, not the new bare-asset fallback.
   - layers route header: does not mention the new 503-unavailable case.
   Flagging so the lead decides whether to fix them in a follow-up.
5. Docs note: `node_modules/next/dist/docs/01-app/01-getting-started/
   15-route-handlers.md` does not exist in this Next version; the equivalent
   `03-api-reference/03-file-conventions/route.md` was read instead. The layers
   route remains a plain `GET(request: Request)` handler — unchanged pattern.
