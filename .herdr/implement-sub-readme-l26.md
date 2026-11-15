# sub-readme — L22/L25/L26 README alignment

Branch: `unit/sub-readme`. Scope: `README.md` only. Commit: `README: L22/L25/L26 data + forecast story`.

## Changes

- **Intro (README.md:6-10):** dropped "(stretch) live Earth Engine layers" framing; now states EE is not on the runtime path (one-off compute / hosted copies only), live EE layers opt-in via `GEE_ENABLED` (`1`/`true`).
- **Seams table:** `src/app/api/ee/status` and `src/lib/ee.ts` rows now say opt-in via `GEE_ENABLED`, 503 while disabled; `public/data/...` row now says committed artifacts synced by `sync:data`, last-resort copy (was "mock artifacts … overwritten when real data lands").
- **Deploy paragraph:** read order per L26 — GitHub `fallback` branch of `r2l2pj/tipping-point-data` primary, Neon Object Storage fallback, `DATA_BASE_URL` overrides both, bundled `public/data` last-resort; Neon Postgres only for the Telegram subscriber store. `now.yml` described as computing TPI locally (L20) from IMERG Early / SMAP / GEOS-FP, publishing one force-pushed orphan commit per run; cadence 3 h / stale warning 6 h unchanged. "GEE non-commercial" removed from the free-tier list (runtime is GEE-free); added GitHub raw.
- **"Replay forecast" section → "Forecast & model":** replaced the perfect-forecast paragraph (L22) — replay D+1..D+3 frames are real NOAA GFS 0.25 issued forecasts labelled `forecast: NOAA GFS (issued <date>)`, the only non-NASA model input, replay-only; `now/` uses NASA GEOS-FP; perfect-forecast frames = labelled upper bound only, never headline. Added the L25 model line: local XGBoost adds P(trigger 24/48/72 h) frames alongside TPI (TPI stays headline), evaluated vs a RandomForest and a TPI-threshold baseline on held-out data — no metric numbers quoted.

## Claims verified (file:line)

- `GEE_ENABLED` accepts only `1`/`true` (case-insensitive), read at request time: `src/lib/ee.ts:18-19`; disabled routes 503 with reason "runtime GEE disabled (GEE_ENABLED unset)": `src/app/api/tiles/route.ts:39-45`, same guard in `layers`, `numbers`, `point`, `metrics` routes; `/api/ee/status` rejects via `earthEngine()` guard `src/lib/ee.ts:69`.
- Read order (L26): `src/lib/data.ts:1-7` and `remoteBases()` `src/lib/data.ts:159-171` — explicit `DATA_BASE_URL` wins alone; else `GITHUB_DATA_BASE` (`…/fallback/data`, :147-148) primary then Neon bucket (`NEON_S3_ENDPOINT` or built-in public URL, :149-152); bundled `public/data` last (`readData`, :233-237).
- Telegram subscriber store = Neon Postgres / HTTPS SQL: `docs/DEPLOY.md:69-110`, `src/lib/telegram/store.ts`.
- GFS issued-forecast frames win on forecast days, perfect-forecast = labelled upper bound, never headline: `src/lib/layers.ts:29-75` (`isGfsFrame` on `forecast_source` containing "gfs" or `_gfs_d<k>` id, :33-38; pick order :62-75). Chip text `forecast · GFS (issued <date>)`: `src/lib/layers.ts:84-89`; source labels `noaa-gfs → NOAA GFS`, `geos-fp → GEOS-FP`: `src/lib/contract.ts:366-368`; probability-layer note `issued <time> · forecast: NOAA GFS`: `src/lib/layers.ts:350-355, 398-403`.
- XGBoost P(trigger) frames `p_trigger_<h>`, horizons 24h/48h/72h/7d/14d with 7d/14d carrying "lower confidence: long-range forecast": `src/lib/layers.ts:354-371`; UI rows appear only when the manifest ships them: `src/components/LayersPanel.tsx:31`. App surfaces "ML model AUC (XGBoost)": `src/components/tabs/ValidationTab.tsx:115`; contract keeps `rf_auc`/`rule_auc` (model vs slope-rule baseline): `public/data/SCHEMA.md:329-341`, `public/data/*/ml_metrics.json`. Baselines/held-out evaluation per L25 ruling; metrics currently null pending labels (`public/data/rs_2024/ml_metrics.json:3-8`).
- `now.yml` every 3 h, force-pushed `fallback` branch, `manifest.json` last; stale warning 6 h: `docs/DEPLOY.md:146-149, 156-157`. Local TPI compute from IMERG/SMAP/GEOS-FP per L20 ruling (job lives in the data repo).
- `predev`/`prebuild` → `sync:data` from sibling repo; `DATA_REPO` override: `package.json` scripts, `scripts/sync-data.mjs:9-11`.
- Free-tier list: `docs/DEPLOY.md:115-127` (minus the now-stale GEE runtime line there).

## Commands and results

1. `git diff --check` — exit 0, clean.
2. `git add README.md && git commit -m 'README: L22/L25/L26 data + forecast story'` — committed `c62e019`, 1 file, 30+/14−.
3. `bun run lint` — not run (brief says not needed; docs-only change).

## Not done / notes

- `docs/DEPLOY.md` is stale w.r.t. L25/L26 (says "GEE stays the source of truth", lists Neon first, keeps the GEE free-tier line, omits `GEE_ENABLED`; `.env.example` also omits `GEE_ENABLED`). Out of scope — README.md only — flagging to lead-submission.
- No performance numbers quoted; landslides remain "candidates"; theme sentence and Credentials section untouched; no secrets added.
