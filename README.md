# tipping-point-app

Fullstack app for **Tipping Point** — NASA Space Apps Challenge 2026,
"Dancing with the SARs". Rain warns. Radar confirms.

Next.js 16 (App Router) + MapLibre + `@google/earthengine`. Serves the artifacts
produced by [`r2l2pj/tipping-point-data`](https://github.com/r2l2pj/tipping-point-data)
and (stretch) live Earth Engine layers through server-side API routes.

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
| `src/components/Dashboard.tsx` | `/` ops dashboard (replay cases + `now/` live mode) |
| `src/components/Map.tsx` + `MapLayers.tsx` | MapLibre dark basemap + v3 layer stack (hillshade → TPI → water → flood → landslide candidates → labels) |
| `src/components/tabs/` | side-panel tabs ALERT · RADAR · Did we get it right? · IMPACT (metrics read via `metricsView`) |
| `src/lib/layers.ts` | layer stack per tab and day, in doc order |
| `src/app/alerts` | public alert feed — same message format as the Telegram bot |
| `src/app/api/events` | events index + per-event manifest |
| `src/app/api/ee/status` | live-GEE health check (service account) |
| `src/app/api/telegram` + `src/lib/telegram/` | Telegram bot webhook + Neon (free) subscriber store via HTTPS SQL endpoint (plain fetch, no dep) — 503 until `TELEGRAM_TOKEN` + `TELEGRAM_SECRET` are set (cred-blocked) |
| `src/lib/ee.ts` | server-only Earth Engine client (`GEE_PROJECT` + `GCP_SA_KEY` in `.env`; `GEE_SERVICE_ACCOUNT_KEY` (fallback) also accepted) |
| `public/data/<event>/`, `public/data/now/`, `public/data/alerts.json` | mock artifacts per SCHEMA.md — overwritten by `sync:data` when real data lands |
| `docs/`, `submission/` | `docs/{PLAN,app-contract,DEPLOY}.md` project doc + contract/deploy notes; `submission/{summary,nasa-data,ai-declaration,demo-script,slides-outline}.md` (incl. ≤30s demo script) |

## Deploy

Vercel (repo is public — Hobby plan can deploy public org repos). `prebuild`
runs the data sync, so committed `public/data` JSON is the deploy fallback.
Live-data fallback (`DATA_BASE_URL` -> `raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback`) + env vars: runbook in `docs/DEPLOY.md`.
The `now.yml` live job refreshes data every 6 h; the stale-data warning
threshold is 12 h. Everything runs on free tiers: GEE non-commercial,
GitHub Actions, Vercel Hobby, Earthdata, Telegram Bot API, Neon free.

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

## Replay forecast

Replay cases run on a declared **"perfect forecast"**: observed IMERG is shown
as the D+1..D+3 forecast, labeled in the app (`forecast_source=perfect-forecast`).
Live mode (`now/`) uses real GEOS-FP.

## Limitations

- Thresholds were calibrated on a single event — no broad statistical validation.
- IMERG and SMAP inputs are ~10 km; the detail comes from terrain. The HAND
  proxy is a simplified NASADEM product validated against MERIT Hydro
  (validation reference only).
- NISAR revisits every ~12 days, so radar confirmation can arrive days after
  the event. L-band coherence loss also occurs with vegetation and rain —
  landslide marks are always candidates, never field confirmation.
- The demo runs in replay, not real time.
- The rs_2024 case has no radar confirmation — the event predates NISAR.
- The wa_2025 radar confirms flood only (NISAR GCOV). Landslide marks are
  candidates from post-event HLS optical, and no GUNW pair spans the event
  (declared limitation).
