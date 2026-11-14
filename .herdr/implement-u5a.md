# U5a — SwipeCompare component + swipe helpers

## What changed

- `src/components/SwipeCompare.tsx` (new): `'use client'` component that mounts
  two MapLibre maps stacked in a relative container. The before map fills the
  container; the after map sits on `absolute inset-0` and is clipped with a CSS
  `clip-path` driven by the divider position (`pct` state, default 50).
  - Camera sync: `move` on either map calls `jumpTo({center, zoom, bearing,
    pitch})` on the other; listeners are detached while `jumpTo` applies so the
    pair can't ping-pong (same guard pattern as mapbox-gl-compare).
  - Divider: full-height hit strip (`w-6`, `cursor-ew-resize`) with a white line
    and a circular handle on a `#0b0e14` chip. Pointer-drag uses
    `setPointerCapture` + `pctFromClientX`; ArrowLeft/ArrowRight step ±2% via
    `dragStep`. `role="slider"` with `aria-valuemin/max/now` for a11y. Clamped
    to 5–95%.
  - Each side renders its PNG as a MapLibre `type: 'image'` source
    (`coordinates` = `[[w,n],[e,n],[e,s],[w,s]]` from the `[w,s,e,n]` bounds,
    per-side `bounds` override supported) under a raster layer on the shared
    dark CARTO no-labels basemap. Zoom clamped 5–13.
  - Initial fit: a shared `fitted` flag makes only the FIRST map to fire
    `'load'` call `fitBounds(bounds, {padding: 60, duration: 0})`; its 'move'
    events sync the camera to the other map. The second map's 'load' only adds
    its image source — a late fit would otherwise revert a user pan and desync
    the pair (diff-review blocking finding, fixed).
  - Date labels: before pinned top-left, after top-right, `text-xs` (12px)
    white on `bg-black/70` chips, `pointer-events-none`.
  - Props signature matches the pinned contract exactly (default export).
  - Both maps `remove()`d on unmount. The two duplicated consts
    (`setWorkerUrl("/maplibre-gl-worker.js")` + CARTO `BASEMAP`) are inline —
    `Map.tsx` untouched (owned by u4).
- `src/lib/swipe.ts` (new): pure helpers, no maplibre import —
  `clipPathFor(pct)` → `inset(0 0 0 X%)`, `pctFromClientX(clientX, rectLeft,
  rectWidth)` clamped 5–95, `cameraPatch(m)` → jumpTo options with all camera
  fields, `dragStep(pct, deltaDir)` → ±2% clamped.
- `src/lib/swipe.test.ts` (new): bun tests covering the exact clip string,
  edge clamps, full camera field pass-through, and step direction + clamp.

## Commands run and results

### `bun install`

```
+ @types/react@19.3.0
+ @types/react-dom@19.3.0
+ eslint@9.39.5
+ eslint-config-next@16.4.6
+ tailwindcss@4.3.3
+ typescript@5.9.3
+ @google/earthengine@1.7.52
+ georaster@1.6.0
+ maplibre-gl@6.18.0
+ next@16.4.6
+ react@19.3.0
+ react-dom@19.3.0
+ recharts@3.10.1

753 packages installed [773.00ms]
```

### `bun test src/lib/swipe.test.ts`

```
src/lib/swipe.test.ts:
(pass) clipPathFor > hides the left X% of the after layer [0.09ms]
(pass) pctFromClientX > maps clientX onto the track as a percent [0.12ms]
(pass) pctFromClientX > clamps at the left edge
(pass) pctFromClientX > clamps at the right edge
(pass) cameraPatch > passes every camera field through to jumpTo options [0.06ms]
(pass) cameraPatch > optional bearing/patch fields stay undefined when absent [0.02ms]
(pass) dragStep > moves 2% in the direction of the arrow [0.02ms]
(pass) dragStep > clamps at the track edges

 8 pass
 0 fail
 18 expect() calls
```

### `bun run build`

```
$ bun run sync:data
sync-data: .../tipping-point-data/data not found — skipping (set DATA_REPO to override)
$ next build
▲ Next.js 16.4.6 (Turbopack)
✓ Compiled successfully in 1095ms
  Running TypeScript ...
  Finished TypeScript in 2.3s ...
✓ Generating static pages using 10 workers (8/8) in 744ms
```

Green. Re-run after the `fitted`-flag fix: 8/8 tests pass, build green
(`✓ Compiled successfully`, `Finished TypeScript in 2.1s`, 8/8 static pages).

Note: first build attempt failed typecheck — `imageCoords` returned
`[number, number][]` but `coordinates` requires a fixed 4-tuple; fixed the
return type. Then a diff review flagged the independent double-`fitBounds`
(race: late second 'load' reverts a user pan); fixed with the shared `fitted`
flag described above.

## Notes for u5b

- Props: `SwipeCompare({ bounds, before, after })` — `bounds: [w,s,e,n]`,
  `before`/`after`: `{ url, label, bounds? }`. Default export.
- Component fills its parent (`h-full w-full`); mount it inside an
  `absolute inset-0` / sized container.
