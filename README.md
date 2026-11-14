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
| `src/components/Map.tsx` + `MapLayers.tsx` | MapLibre dark basemap + v3 layer stack (hillshade → TPI → water → flood → scars → labels) |
| `src/app/alerts` | public alert feed — same message format as the Telegram bot |
| `src/app/api/events` | events index + per-event manifest |
| `src/app/api/ee/status` | live-GEE health check (service account) |
| `src/lib/ee.ts` | server-only Earth Engine client (`GEE_PROJECT` + `GEE_SERVICE_ACCOUNT_KEY` in `.env`) |
| `public/data/<event>/`, `public/data/now/`, `public/data/alerts.json` | mock artifacts per SCHEMA.md — overwritten by `sync:data` when real data lands |
| `docs/`, `submission/` | method notes; ≤30s demo script + submission materials |

## Deploy

Vercel (repo is public — Hobby plan can deploy public org repos). `prebuild`
runs the data sync, so committed `public/data` JSON is the deploy fallback.
