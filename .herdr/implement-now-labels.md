# now-labels — live Now city labels

## What changed

`src/lib/data.ts` — the live `now` case publishes no `places` product, so
`bundle.places` was undefined and MapLayers' `tp-places` source / `cityLabel`
layer rendered nothing. Added, all server-side in `getCaseBundle`:

- `NOW_CITY_NAMES`: the 21 RS/SC/PR anchor cities (capitals + big cities).
- `placeKey`: NFD strip + lowercase — accent/case-insensitive name matching.
- `representativePoint(geometry)`: area (shoelace) centroid of the largest
  exterior ring when it lands inside the polygon; concave municipalities
  (Foz do Iguaçu's centroid falls outside) get a 64×64 bbox grid scan for
  the inside point nearest the centroid; first vertex is the last resort.
- `nowCityPlaces(boundaries)`: matches the wanted names against the
  municipal_boundaries FeatureCollection (name / nome / NM_MUN), emits
  `{type:"Feature", properties:{name: <file's own spelling>, kind:"city"},
  geometry: Point}` in the exact shape replay places.geojson uses; unmatched
  names are skipped; absent boundaries -> undefined (no fabricated labels).
- Hookup: `effectivePlaces = places ?? (now ? nowCityPlaces(await
  geo("municipal_boundaries", "geojson/municipal_boundaries.geojson")) : undefined)`.
  A real places.geojson wins when published; municipal_boundaries is only
  fetched for `now` when no places file exists anywhere. `bundle.places`
  and the `declaredMissing` pending check use `effectivePlaces`.
- Only ~21 small Points ride the RSC bundle — the ~840KB polygon file stays
  server-side (verified: 21 `kind:"city"` features in the streamed HTML).

`src/lib/data.test.ts` — 4 new tests in `describe("now@2 bundle")`:
- staged municipal_boundaries + no places anywhere -> bundle.places carries
  exactly the listed Points, `kind:"city"`, finite coords.
- staged places.geojson wins and municipal_boundaries is never requested.
- nowCityPlaces: accent/case-insensitive matching both directions, file
  spelling kept, unlisted names skipped, empty/absent -> undefined.
- representativePoint: convex -> centroid; concave (C-shape, centroid in the
  notch) -> still strictly inside (independent ray-cast); Point/null ->
  undefined.

Environment note: this worktree's `node_modules` was a symlink into the
sibling `integrate-cc` worktree — Turbopack's hermetic root check refused
`next build` ("Could not find the Next.js package"). Replaced with a real
`bun install` (gitignored, worktree-local; no repo file changed).

## Commands run and results

- `bun test` — 685 pass, 17 skip, 0 fail across 43 files (was 678 before;
  +4 new tests, +3 pre-existing skips stay).
- `bunx tsc --noEmit` — clean (2 RouteContext/LayoutProps noise errors
  pre-existed at HEAD until `next build` generated `.next/types`; gone now).
- `bun run build` — OK (Next 16.4.6 Turbopack, compiled 14.5s, / is ◐ PPR).
- `bun run start -p 3125`; `curl -s -o /dev/null -w %{size_download}` on `/`
  — 268,383 bytes (< 300 KB).
- Playwright (createRequire at ~/.npm/_npx/9833c18b2d85bc59/node_modules,
  chromium args `--use-angle=swiftshader --enable-unsafe-swiftshader`,
  script `.herdr/verify-now-labels.mjs`):
  - `window.__map.querySourceFeatures("tp-places").length` = 34 (> 0;
    maplibre returns tile-boundary duplicates — 21 unique names).
  - names incl. Porto Alegre, Florianópolis, Curitiba, Chapecó, Criciúma,
    Foz do Iguaçu — proper accents.
  - console errors: 0.
  - screenshot `.herdr/now-labels.png` — labels visibly render on the Now
    map. Server stopped after proof.

Commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
per branch convention.
