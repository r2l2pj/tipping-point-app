# Unit L8 — GEE-first case-bundle loader (geeload)

## What changed

`src/lib/data.ts`
- `getCaseBundle` gained an optional 5th param `opts?: CaseBundleOpts` with
  `opts.gee = { numbers?, layers? }`. Injected gee is used as-is and skips the
  credential gate (presence = credentialed).
- When no injected gee and `GCP_SA_KEY`/`GEE_SERVICE_ACCOUNT_KEY` is set, the
  real helpers load via dynamic `import("./ee" | "./ee-numbers" | "./ee-layers")`
  inside the live path — no static edge into ee-* (they import
  `getRootManifest` from data.ts) and ee stays off the no-creds path.
- Live calls run via `Promise.allSettled` concurrently with the static file
  loads. Numbers query date: replay → `reference_date`; `now` → `_d0` layer
  date → `data_dates.observed` → `reference_date`. Case id canonicalized via
  `canonicalCaseId`.
- Overlay applied on the built bundle before return:
  - numbers → `metricsView.people_critical` (from `people_exposed`),
    `flooded_km2` + `flood_source='nisar'`, `people_flooded`; on `now`,
    `km2_critical` → `summary.critical_km2.any` (only that key) and
    `people_exposed` → `summary.people_exposed` + `summary.people_critical`.
  - layer meta → `bundle.liveLayers: LayerMeta[]`; an answered but empty
    layers array = degraded.
- New `LoadedCaseBundle` fields: `liveLayers`, `dataSource`
  ('gee'|'static', undefined when not credentialed), `dataDate`
  (numbers.data_date when live numbers applied).
- `fallback` = `ctx.fellBack` OR (credentialed AND (empty layers OR every
  attempted live call produced no content)). Not credentialed → unchanged.

`src/lib/data.test.ts` — new "live GEE overlay (injected gee)" describe with
4 tests: replay overlay incl. flood_source='nisar' + liveLayers + dataDate;
now-case summary overlay with d0 query date (fs mode, bundled now/ copy);
numbers+layers errors → fallback/dataSource='static'/static preserved;
empty layers → fallback even with numbers applied. Also asserted
dataSource/liveLayers/dataDate undefined on the no-creds fs test.

`docs/app-contract.md` — added "Live overlay (L8)" section documenting the
overlay fields, fallback semantics, and the empty-layers degraded case.

## Commands run

- `bun test` — 223 pass, 0 fail (was 1 fail mid-run: the now test originally
  used DATA_BASE_URL and un-staged geojson products tripped ctx.fellBack;
  switched it to fs mode against the bundled now/ copy).
- `bun run lint` — 0 errors (1100 pre-existing warnings).
- `bunx tsc --noEmit` — 2 pre-existing errors in files outside scope
  (`app/api/events/[id]/manifest/route.ts`, `app/layout.tsx`); none in
  changed files.

## Notes

- No dependency changes; ee-*.ts, routes, components untouched.
- `LayerMeta` is imported as `import type` only — erased at compile, no
  runtime cycle.
