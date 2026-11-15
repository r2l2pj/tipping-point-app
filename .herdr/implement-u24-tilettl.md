# u24-tilettl — tile cache TTL edge case

## Change

`src/lib/ee-tiles.ts`
- `TTL_MS`: 2 h → 1 h (3_600_000 ms), now `export`ed so tests can assert the
  invariant.
- Comment at the constant spells out the invariant: in-mem TTL (1 h) + edge
  `s-maxage` (`CACHE_TILES_REPLAY`, 1 h) <= ~2 h EE urlFormat token life, so a
  cached tile URL can never be served after its token dies.
- Header comment "cached ~2 h" → "cached ~1 h".

`src/lib/ee-tiles.test.ts`
- `expires_at` expectation updated to `now + 3600e3`.
- "expired entry refetches" advances the clock by 1 h (past TTL − skew).
- New test: `TTL_MS + s-maxage from CACHE_TILES_REPLAY (imported from
  ./http-cache) <= 2*3600e3`.
- Renamed local `TILE_TTL_MS` → `TOKEN_LIFE_MS` in the GET /api/tiles suite
  (it denotes the ~2 h token life, not the cache TTL) and corrected its
  comment.

## Commands run

- `bun install --frozen-lockfile` — 780 packages installed.
- `bun test` — 385 pass, 7 skip (live gee/neon smokes), 0 fail.
- `bun run build` — Next.js 16.4.6 build + TypeScript green.
- `bunx eslint src/lib/ee-tiles.ts src/lib/ee-tiles.test.ts` — clean.
