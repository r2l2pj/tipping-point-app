# tipping-point-app

Fullstack app for **Tipping Point** — NASA Space Apps Challenge 2026,
"Dancing with the SARs". Rain warns. Radar confirms.

Next.js 16 (App Router) + MapLibre + `@google/earthengine`. Serves the artifacts
published by [`r2l2pj/tipping-point-data`](https://github.com/r2l2pj/tipping-point-data).
Earth Engine is not on the runtime path — it is used only for one-off compute and
hosted copies; live EE layers stay off by default, opt-in via `GEE_ENABLED`
(`1`/`true`).

## Run

```bash
bun install
bun run dev          # predev syncs ../tipping-point-data/data -> public/data
```

`DATA_REPO=/path/to/tipping-point-data` overrides the sibling-repo default.

## Seams

| Path | Role |
| --- | --- |
| `src/lib/data.ts` + `src/lib/types.ts` + `src/lib/contract.ts` | reader/normalizer for the data contract (`public/data`, see SCHEMA.md) |
| `src/lib/tpi.ts` | TPI classes/palette + `mockTpiGrid` synthetic raster stand-in |
| `src/app/page.tsx` + `src/components/command/` | `/` Command Center: opens on Now (Southern Brazil live, refreshed every 3 h); `?case=<id\|alias>&day=<offset>` deep-links a replay case and day. Right panel is response first ("Now on the ground"), then "Prediction"; evidence for replays ("How early? (in replay)", "Why radar") and the NISAR before/after compare |
| `src/components/Map.tsx` + `MapLayers.tsx` | MapLibre dark basemap + v3 layer stack (hillshade → TPI → water → flood → landslide candidates → labels) |
| `src/lib/layers.ts` | layer stack per tab and day, in doc order |
| `src/app/alerts` | public alerts: the same Command Center screen with the public alert view in the right panel — same message format as the Telegram bot |
| `src/app/api/events` | events index + per-event manifest |
| `src/app/api/ee/status` | live-GEE health check (service account; opt-in — needs `GEE_ENABLED` = `1`/`true`, else 503) |
| `src/app/api/telegram` + `src/lib/telegram/` | Telegram bot webhook + Neon (free) subscriber store via HTTPS SQL endpoint (plain fetch, no dep) — 503 until `TELEGRAM_TOKEN` + `TELEGRAM_SECRET` are set (cred-blocked) |
| `src/lib/ee.ts` | server-only Earth Engine client (`GEE_PROJECT` + `GCP_SA_KEY` in `.env`; `GEE_SERVICE_ACCOUNT_KEY` (fallback) also accepted) — opt-in via `GEE_ENABLED`; EE API routes return 503 while disabled |
| `public/data/<event>/`, `public/data/now/`, `public/data/alerts.json` | committed artifacts per SCHEMA.md — synced by `sync:data`; last-resort copy when every remote read misses |
| `docs/`, `submission/` | `docs/{PLAN,app-contract,DEPLOY}.md` project doc + contract/deploy notes; `submission/{summary,nasa-data,ai-declaration,demo-script,slides-outline}.md` (incl. ≤30s demo script) |

## Deploy

Vercel (repo is public — Hobby plan can deploy public org repos). `prebuild`
runs the data sync, so committed `public/data` is the last-resort deploy
fallback. Read order: the `fallback` branch of `r2l2pj/tipping-point-data`
(`raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data/`) is the
primary source, Neon Object Storage is the fallback, and an explicit
`DATA_BASE_URL` overrides both — runbook in `docs/DEPLOY.md`. Neon Postgres
serves only the Telegram subscriber store.
The `now.yml` live job refreshes data every 3 h: it computes TPI locally
from IMERG Early / SMAP / NOAA GFS forecast rain and publishes the result as one
force-pushed orphan commit per run (`manifest.json` last). The stale-data
warning threshold is 6 h. Everything runs on free tiers: GitHub Actions,
GitHub raw, Vercel Hobby, Earthdata, Telegram Bot API, Neon free.

## Credentials

Earthdata auth uses a bearer token: env var and GitHub secret
`EARTHDATA_TOKEN` (the name earthaccess reads natively). Tokens expire
~60 days — renew `EARTHDATA_TOKEN` before judging ends; the live cron
(`now.yml`) fails loudly when the token dies. `EDL_USER`/`EDL_PASS`
remain a local-only fallback, never in secrets.

The Telegram subscriber store uses `DATABASE_URL` (Neon connection string,
server-only) — set in Vercel env + GitHub secrets, never in repos.

Full env list (`GCP_SA_KEY` canonical; `GEE_SERVICE_ACCOUNT_KEY` fallback;
`DATABASE_URL` for the subscriber store): `docs/DEPLOY.md`.

## Forecast & model

Forecast rain = NOAA GFS 0.25°, our only non-NASA input; every observation
is NASA (IMERG, SMAP, NISAR, OPERA, NASADEM, GPW, Black Marble). The same
model feeds both modes, so the replay's "how early" check measures the
forecast the live view uses: replay D+1..D+3 frames use the GFS forecast
issued on each day, live mode (`now/`) uses the latest GFS run, labelled
`forecast · NOAA GFS (issued <date>)`. Perfect-forecast
frames (observed IMERG shown as D+1..D+3) are kept only as a labelled upper
bound, never the headline.

A local XGBoost model adds P(trigger 24/48/72 h) probability frames
alongside TPI, which stays the headline index; longer-range horizons carry
a visible lower-confidence label. The model is evaluated against a
RandomForest and a TPI-threshold baseline on held-out data.

## Limitations

- Thresholds were calibrated on a single event — no broad statistical validation.
- IMERG and SMAP inputs are ~10 km; the detail comes from terrain. The HAND
  proxy is a simplified NASADEM product validated against MERIT Hydro
  (validation reference only).
- NISAR revisits every ~12 days, so radar confirmation can arrive days after
  the event. L-band coherence loss also occurs with vegetation and rain —
  landslide marks are always candidates, never field confirmation.
- The video demo is a replay of past events; the live view (`now/`) covers Southern Brazil only and refreshes every 3 h.
- The rs_2024 case has no radar confirmation — the event predates NISAR.
- The wa_2025 radar confirms flood only (NISAR GCOV). Landslide marks are
  candidates from post-event HLS optical, and no GUNW pair spans the event
  (declared limitation).
