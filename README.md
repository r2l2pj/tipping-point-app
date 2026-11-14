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
| `src/lib/data.ts` + `src/lib/types.ts` | reader for the data contract (`public/data`, see SCHEMA.md) |
| `src/lib/tpi.ts` | TPI classes/palette + `mockTpiGrid` synthetic raster stand-in |
| `src/components/Dashboard.tsx` | `/` ops dashboard (replay cases + `now/` live mode) |
| `src/components/Map.tsx` + `MapLayers.tsx` | MapLibre dark basemap + v3 layer stack (hillshade → TPI → water → flood → landslide candidates → labels) |
| `src/app/alerts` | public alert feed — same message format as the Telegram bot |
| `src/app/api/events` | events index + per-event manifest |
| `src/app/api/ee/status` | live-GEE health check (service account) |
| `src/lib/ee.ts` | server-only Earth Engine client (`GEE_PROJECT` + `GCP_SA_KEY` in `.env`; `GEE_SERVICE_ACCOUNT_KEY` (fallback) also accepted) |
| `public/data/<event>/`, `public/data/now/`, `public/data/alerts.json` | mock artifacts per SCHEMA.md — overwritten by `sync:data` when real data lands |
| `docs/`, `submission/` | `docs/PLAN.md` project document + method notes; `submission/{summary,nasa-data,ai-declaration,demo-script,slides-outline}.md` (incl. ≤30s demo script) |

## Deploy

Vercel (repo is public — Hobby plan can deploy public org repos). `prebuild`
runs the data sync, so committed `public/data` JSON is the deploy fallback.

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
  the event.
- The demo runs in replay, not real time.
- The RS-2024 case has no radar confirmation — the event predates NISAR.
- The wa_2025 radar confirms flood only (NISAR GCOV). Landslide marks are
  candidates from post-event HLS optical, and no GUNW pair spans the event
  (declared limitation).
