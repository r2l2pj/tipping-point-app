# implement — L5 COG pixel reader via geotiff.js (unit/cog-reader)

## What changed

- **`package.json` + `bun.lock`**: `bun add geotiff` → resolved `geotiff@3.0.5`,
  pinned exact (`"geotiff": "3.0.5"`). Lockfile delta is the geotiff 3.0.5
  block + its transitive deps only (`lerc`, `pako@2`, `parse-headers`,
  `quick-lru`, `web-worker`, `xml-utils`, `zstddec`, `@petamoriken/float16`);
  georaster keeps its own pinned `geotiff@1.0.0-beta.13` — no other dep
  changes.
- **`src/lib/cog.ts`** (new, isomorphic/fetch-based, no DOM or Node APIs):
  - `openCog(url)` — lazy `fromUrl` + `Promise<GeoTIFF>` cache keyed by URL;
    `blockSize: 65536` enables geotiff's range block cache so repeated pixel
    reads share fetched COG blocks. Failed opens are evicted for retry.
    (`blockSize` is forwarded to the BlockedSource at runtime but missing
    from `RemoteSourceOptions` — typed via a local intersection.)
  - `readCogPixel(url, lon, lat, opts?) → Promise<number|null>` — nearest
    sample at lon/lat over `image.getBoundingBox()` (EPSG:4326); out-of-extent,
    nodata (`getGDALNoData()`), non-finite, and any error → `null`.
  - Band resolution (`CogPixelOptions`): `band` (0-based sample index, bounds
    checked) wins; else `date` ("YYYY-MM-DD" or "YYYYMMDD") matches per-band
    GDAL `DESCRIPTION` items via `getGDALMetadata(sample)`; when the
    GDAL_METADATA tag is absent it falls back to positional lookup in
    `opts.bandOrder`. Unresolvable date on multiband → `null`; a `date` opt
    on a single-band static layer (T_slide/T_flood) still reads band 0.
  - `readCogRST({r,s,t}, lon, lat, opts) → {r,s,t}` — parallel reads; absent
    URLs and failures degrade to `null` per channel.
  - `cogLayerUrl(manifestPath, base, caseDir)` — thin typed wrapper over
    `resolveAsset` (imported, not re-implemented).
- **`src/lib/cog.test.ts`** (new, bun:test, hermetic — no external network):
  - Fixtures built in-test with geotiff's `writeArrayBuffer`: 4x2 Float32
    EPSG:4326 grids (0.5° pixels, tiepoint/pixel-scale, `GDAL_NODATA`), one
    single-band with a nodata pixel and one 3-band with per-band
    `DESCRIPTION` items `20240501..03`.
    Note: `fieldTagTypes[42112]` (GDAL_METADATA) is registered as ASCII
    before writing — the writer ships no type entry for that tag; readers
    don't need it.
  - Served through `Bun.serve` honoring `Range: bytes=a-b` → 206 +
    `Content-Range` (real COG host behavior for `fromUrl`).
  - 16 tests: pixel read, edge clamping, out-of-extent/nodata/unreachable →
    null, band-by-date via DESCRIPTION, `bandOrder` fallback, band precedence
    and bounds, single-band date fallback, `openCog` URL caching
    (same-promise identity), `readCogRST` parallel + degraded channels,
    `cogLayerUrl` resolveAsset semantics (gs://, http, relative, undefined).

## Commands / results

- `bun install` → 753 packages, clean.
- `bun add geotiff` → 3.0.5; then pinned exact in package.json + `bun install`.
- `bun test src/lib/cog.test.ts` → **16 pass, 0 fail** (27 expects).
- `bun run lint` → **0 errors** (1100 pre-existing warnings elsewhere; nothing
  on cog.ts / cog.test.ts).
- `bunx tsc --noEmit` → clean on L5 files. Two pre-existing errors remain on
  baseline too (verified via `git stash`): `route.ts` `RouteContext` and
  `layout.tsx` `LayoutProps` — Next 16 generated types absent until
  `next dev`/`build` runs in this worktree; not this unit's scope.
- `git diff origin/main -- package.json bun.lock` → only the geotiff
  addition + its transitive deps.

## Notes for downstream units

- Popup (lead-front) flow: `cogLayerUrl(layer.cog, dataBase, caseDir)` →
  `readCogRST({r, s, t}, lon, lat, { date })`; `null` = degrade to the
  day-level series values.
- `date` accepts both `YYYY-MM-DD` and `YYYYMMDD`; `bandOrder` should be the
  manifest-declared day list when GDAL descriptions might be stripped.
- All opens are cached per URL process-wide — safe to call per click.
