# L52 — replay city finder (replay-city)

## What changed

- `src/components/command/model/replayPlaces.ts` (new) — pure adapter:
  - `ReplayPlace extends Place` — empty hazard days, plus `outline`
    (municipal polygon feature), `teammateKm2`, `code` (IBGE).
  - `replaySource(bundle, livePlacesUrl)` — `geo` = the case's own
    `municipal_boundaries` + `places` products (geoUrl/caseDirOf);
    `live-box` = the live places.json filtered to the case bbox (RS-style
    fallback); `undefined` = hide the box.
  - `replayPlacesFrom(muni, towns)` — polygons → entries (bbox from
    geometry, centroid = bbox centre), towns merged deduped by name.
  - `filterPlacesToBBox`, `placesDailyUrl`, `replayDayClass`
    (places[<code>].observed[<date>].flood_class_max).
- `model/places.ts` — `searchPlaces` genericized (`<P extends Place>`) so
  ReplayPlace reuses the fuzzy matcher.
- `CitySearch.tsx` — `url` prop → `source: SearchSource` (live / live-box
  / geo); loads one or two files accordingly. Same combobox UX.
- `ReplayCityCard.tsx` (new) — name, UF, population (estimate, GPW),
  `NISAR flood candidates (teammate map): X km²` when
  `teammate_candidates_km2` is present, and the step day's observed flood
  class (`Flood on <Mon D>: High`) when `products.places_daily` is
  published. No live forecast numbers; close button.
- `MapStage.tsx` — `cityOutline` prop: a `tp-city-outline-line` GeoJSON
  line layer in the accent colour (#17473f), removed on close.
- `CommandCenter.tsx` — `searchSource` per active case (`key={bundle.id}`
  remounts the box); a replay pick stays in the replay (no setMode to
  Now), flies to the polygon bbox (setFocus), shows pin + outline +
  ReplayCityCard; `places_daily` fetched once per replay (URL-keyed read
  guards stale files). The card closes on a case switch (guarded render
  reset). `?city=` still resolves only in Now (initialCityId only when
  the live case is active). Now behavior untouched.

## Commands run (memory-capped)

```
B=$HOME/.local/share/mise/installs/bun/1.4.4/bin/bun
systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=1G \
  --working-directory=$PWD -E PATH=$PATH -E TMPDIR=$HOME/.cache/lead-app/tmp
```

- `$B test` (full suite): **816 pass / 0 fail / 17 skip** (+9 new tests).
- `$B x tsc --noEmit -p .`: clean except 2 pre-existing errors in untouched
  `src/app` files (RouteContext, LayoutProps).
- `$B x eslint src/components`: 0 errors, 4 pre-existing warnings.

## Browser check notes

- `rs_2024` and `wa_2025` both declare `municipal_boundaries` + `places` →
  replay search uses the case files (138 RS municipalities / 260 WA
  subdivisions — neither ships uf/pop/teammate fields; those rows degrade
  gracefully).
- Uruguaiana (`rs_uruguai_2026`) isn't in the local manifest; when its
  products declare `municipal_boundaries` (with code/uf/pop/
  teammate_candidates_km2) + `places_daily` the card shows all rows.
