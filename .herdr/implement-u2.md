# implement — U2 v4 contract normalization layer (lead-integration)

## What changed

- **`src/lib/contract.ts`** (new, pure functions, no deps):
  - `MetricsV4` flat-key type + `toMetricsView(raw)` accepting both flat v4
    and the legacy nested mock (`flood`/`model`/`alert`/`cloud`/`impact`).
    Percent keys (`cloud_pct`, `landslide_hit_pct`, `hand_validation`,
    `night_light_drop_pct`, `warned_before_pct`) arriving `> 1` are read as
    0-100 and divided by 100 — the UI always gets 0-1 fractions. Scores
    (`iou`, `f1`, `*_auc`) pass through. Legacy mapping:
    `flood.area_km2→flooded_km2`, `model.auc→rf_auc`,
    `alert.lead_hours_median→lead_time_median_h`,
    `impact.people_exposed→people_critical`, `impact.lights_out_pct→night_light_drop_pct`.
    Decision: the view carries **no `raw` copy** — the untouched payload
    stays available on `CaseBundle.metrics`; unknown flat keys (e.g.
    `landslide_ml`) pass through the view.
  - `toNowView(raw)` → `NowView`: hoists top-level `nisar_passes` (falls back
    to `data_dates.nisar_passes` for legacy syncs), `products` map, resolved
    per-layer `forecast` — explicit flag wins, otherwise `/_d[1-3]$/` on the
    layer id marks a forecast day. `updated_at: null` tolerated (mid-run).
  - `caseAlias(id)` both directions (`rs-2024-05↔rs_2024`,
    `wa-2025-12↔wa_2025`), plus `canonicalCaseId(id)` (underscore form,
    unknown ids pass through).
  - `resolveAsset(base, caseDir, path)`: null/empty → `undefined`; http(s)
    passthrough; `gs://bucket/key` → `https://storage.googleapis.com/bucket/key`;
    else `base/caseDir/key` with case-dir dedup (manifest-style keys already
    carrying the dir aren't doubled).
  - `FORECAST_SOURCE_LABELS` + `forecastSourceLabel()`: `perfect-forecast` →
    "previsão perfeita", `geos-fp` → "GEOS-FP"; unknown passes through.
  - Types for the bundle: `NowSummary` (incl. `people_exposed` per contract
    pin), `NowAlertsFile`/`NowAlertCandidate` (`class:int`, `centroid`,
    `pixels`, `hold`), `ProductMap`, `NowLayer`, `NowView`.
- **`src/lib/types.ts`**: `ManifestCase`/`EventManifest` gained optional
  `event_id`, `products`, `forecast_source` (E1/E3 — root-manifest keys are
  canonical underscore ids; event_id is the hyphen alias; paths always
  explicit). `CaseBundle` gained optional `metricsView`, `summary`, `swot`,
  `catalog`, `municipalities`, `products`, `nowAlerts` — `import type` from
  contract.ts only, no runtime dep. Existing fields untouched.
- **`test/fixtures/`**: `metrics.flat.json` (v4 flat, mixed 0-1/0-100 pct
  scales), `metrics.legacy.json` (verbatim copy of
  `public/data/wa-2025-12/metrics.json`), `now.manifest.json` (now@2:
  forecast flag + `_d2` fallback + top-level `nisar_passes` + `products`),
  `manifest.root.json` (underscore keys + `event_id` + per-case `products` +
  `forecast_source`; pt-BR legend arrays).
- **`src/lib/contract.test.ts`**: 23 tests over the fixtures — flat/legacy
  normalize identically on shared keys, pct>1 rescale, forecast flag +
  regex fallback + flag precedence, passes hoisting, alias round-trips,
  all four `resolveAsset` forms, labels.
- **`docs/app-contract.md`**: consumer-side checklist pointing at
  `tipping-point-data/data/SCHEMA.md` as the single source of truth — layer
  ids → app behavior, products map → consumers + fixed-name fallback, now@2
  node, flat metrics keys + scale rule, `forecast_source` values.

## Commands / results

- `bun test src/lib/contract.test.ts` → **23 pass, 0 fail** (84 expects).
- `bun run lint` → **0 errors** (1100 pre-existing warnings elsewhere; eslint
  on the three touched files is silent).
- `bunx tsc --noEmit` → clean on U2 files (only `bun:test` TS2307s remain in
  `src/lib/telegram/*.test.ts`, another unit's scope; `bun-types` isn't
  installed and no new dep allowed — my test file carries a
  `@ts-expect-error` on the `bun:test` import).

## Notes for downstream units

- Read metrics via `metricsView` (0-1 fractions guaranteed); `CaseBundle.metrics`
  keeps the raw payload.
- `toNowView` layers always carry a resolved boolean `forecast`.
- Manifest paths may be `gs://` in the bucket era — always go through
  `resolveAsset`, never string-concat.
