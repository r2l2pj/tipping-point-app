# u13-leadtime — merged lead-time/validation metrics surface

## Files changed
- `src/lib/ee-metrics.ts` — extended into manifest-base + GEE-overlay merge.
- `src/lib/ee-metrics.test.ts` — extended (26 tests in this file).
- `src/app/api/metrics/route.ts` — status mapping for merged semantics.

## Design implemented
Response: `{ case, canonical, data_date, updated_at, sources: ("manifest"|"gee")[], metrics }`.

- BASE: `data.getMetrics(canonical)` (metrics.json#<case> fragment) supplies all keys
  including non-scalars. Missing/empty fragment = "manifest has no data" (not an
  error); the `"data: metrics for <id> not found"` throw is mapped to absent,
  any other throw = manifest failure.
- OVERLAY (best-effort, only when an `ee` handle exists): asset
  `${eeAssetRoot()}/${canonical}/metrics`. NUM_KEYS whitelist extended with
  `warned_24h_pct`, `never_critical_pct`, `n_points`, `event_lead_h`,
  `critical_area_km2`, `critical_area_with_damage_pct` (finite numbers only);
  `anchor_precision` only when `hour|date|mixed`; `official_warning_delta_h`
  when number or null. Asset scalars override same-named manifest keys;
  non-scalars never come from the asset.
- `data_date`/`updated_at`: from the asset; `null` when manifest-only.
- Creds check moved into the service boundary: `getMetrics` builds the service
  with `ee = undefined` when `credentialEnv()` is unset, so the manifest path
  answers without credentials. `createMetricsService(ee?, opts)` — `ee` absent
  means "no overlay configured"; `opts.readManifest` is injectable for tests
  (default wraps `data.getMetrics`).
- A failed `earthEngine()` init degrades like any overlay failure: the module
  entry wraps the mapped init error in a sentinel `failedEe` whose `Image()`
  throws it, so manifest data still yields 200 `sources: ["manifest"]`, and an
  absent manifest surfaces the real init error (502 service / 503 timeout per
  message prefix). Dead-init services are not cached — init retries next call
  (result/negative caches live in the module map and persist). Test seam:
  `setMetricsEeFactoryForTest` injects the init factory and resets the cached
  service.

## Status semantics (changed from U12c)
- 400 missing `case` (unchanged).
- 200 whenever manifest has data OR overlay succeeds. GEE failure with manifest
  data → 200 `sources: ["manifest"]`. No creds + manifest data → 200 (was 503).
- 404 only when both answer and neither has data (fragment absent + asset
  not-found) → `MetricsNotFoundError`.
- 503 both-dead: manifest read throws AND (no creds OR gee error/timeout) → new
  `MetricsUnavailableError`. Gee timeout with manifest merely absent still →
  `MetricsTimeoutError` → 503; no creds + no manifest → `CredsError` → 503.
- `MetricsResult.data_date`/`updated_at` widened to `string | null`; `metrics`
  is `Omit<MetricsV4,"flood_source"> & ValidationMetrics` (overlay widens
  `flood_source` to include `null`).
- Negative cache now only for true not-found (`MetricsNotFoundError`) and
  both-dead (`MetricsUnavailableError`), 30s. Gee timeouts with an answering
  (absent) manifest are no longer negative-cached. Positive merged results
  cached 10m per canonical as before.
- New error class `MetricsUnavailableError` added; existing class names kept.

## Commands run
- `bun install --frozen-lockfile` — 762 packages, clean.
- `bun test` — 231 pass / 0 fail (incl. dead-init cases a/b via eeFactory seam).
- `bun run build` — green (sync:data warn-skip; /api/metrics dynamic).
- `bun run lint` — 0 errors on touched files (repo has pre-existing warnings).
