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
| `src/app/api/events` | events index + per-event manifest |
| `src/app/api/ee/status` | live-GEE health check (service account) |
| `src/lib/ee.ts` | server-only Earth Engine client (`GEE_PROJECT` + `GEE_SERVICE_ACCOUNT_KEY` in `.env`) |
| `src/components/Map.tsx` | MapLibre dark basemap — layers get added here |
| `docs/`, `submission/` | method notes; ≤30s demo script + submission materials |

## Deploy

Vercel (repo is public — Hobby plan can deploy public org repos). `prebuild`
runs the data sync, so committed `public/data` JSON is the deploy fallback.
