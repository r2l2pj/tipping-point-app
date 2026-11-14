# Deploy

Operator runbook for deploying `tipping-point-app` to Vercel with live data
served from Earth Engine, with a raw fallback branch and bundled last resort.

**Credential rule:** credentials live in environment variables / platform
secrets only — never in the repository. No key, token, or service-account JSON
is ever committed; `.gitignore` already blocks the usual key file patterns.

## Vercel

1. Import the repo into a Vercel project (Hobby plan is fine for a public repo).
   The build runs `prebuild` → `scripts/sync-data.mjs`, which copies artifacts
   from the sibling `tipping-point-data` checkout into `public/data`. On Vercel
   the sibling checkout is absent, `DATA_REPO` is unset, and the sync step
   warns and exits 0 — the committed `public/data` fixtures become the build
   fallback.
2. Set the environment variables below in the Vercel project settings.

| Variable | Purpose |
| --- | --- |
| `DATA_BASE_URL` | Optional fallback data base URL override. Defaults to `https://raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data/`; bundled `public/data` is the last resort on a remote miss. |
| `GEE_PROJECT` | Google Cloud project registered for the Earth Engine API. |
| `GCP_SA_KEY` | Service-account JSON key (single line) for Earth Engine access. Server-side only — never `NEXT_PUBLIC_`-prefixed. |
| `TELEGRAM_TOKEN` | Bot token from BotFather, used to call the Telegram Bot API. |
| `TELEGRAM_SECRET` | Shared secret Telegram sends as `X-Telegram-Bot-Api-Secret-Token`; the webhook route verifies it. |
| `APP_URL` | Canonical public URL of the deployment (e.g. `https://<project>.vercel.app`), used to register the webhook. |

## Data availability

GEE stays the source of truth. The fallback copy lives on the orphan branch
`fallback` of `r2l2pj/tipping-point-data`, force-pushed each run so history
does not grow. It preserves the `data/` tree at the branch root: EPSG:3857
PNGs, JSON numbers, GeoJSON, and `manifest.json` written **last** in the
commit. No COGs are published on this branch.

The app defaults `DATA_BASE_URL` to
`https://raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data/`.
An environment override is still supported and is read at request time, so
updating fallback data does not require a redeploy. The copy bundled into
`public/data` by `bun run sync:data` is the last resort when a remote read
fails; it is not the live source of truth.

## Telegram webhook

After the app is deployed and `TELEGRAM_TOKEN` / `TELEGRAM_SECRET` / `APP_URL`
are set, register the webhook once:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/setWebhook" \
  -d url="$APP_URL/api/telegram" \
  -d secret_token="$TELEGRAM_SECRET"
```

## Scheduled jobs (GitHub Actions)

GEE-first architecture: app tiles and numbers resolve through our `/api`
routes against Earth Engine; the static manifest + raw branch copy stays the
fallback contract the app degrades to. Workflows on the data repo:

- `now.yml` — every 3 h: IMERG Early + SMAP L4 + GEOS-FP ingest →
  `tipping-point/now/` asset collections → TPI + D+1..D+3 in GEE → last-good
  static copy on the force-pushed `fallback` branch (`manifest.json` written last).
- `nisar.yml` — daily: `asf_search` for new GCOV granules over the case AOIs
  and active alert areas.
- `validation.yml` — daily while a case is active: OPERA DSWx + SWOT
  Hydrocron table asset.
- `reference.yml` — weekly/manual: landslide catalogs + municipal
  boundaries.

Secrets (`EARTHDATA_TOKEN` ~60-day renewal, `GCP_SA_KEY`) live in GitHub
secrets; a missing/expired token fails the job loudly. Jobs are idempotent,
log their ingestions, and publish the last-good static copy the app falls
back to.

## Data pipeline secrets (GitHub)

These live as GitHub Actions secrets on the data repo — they are NOT app
runtime vars, so keep them out of the Vercel env table.

- `EARTHDATA_TOKEN` — NASA Earthdata bearer token used by the data pipeline
  (earthaccess env strategy / asf_search `auth_with_token` /
  `GDAL_HTTP_HEADERS` `Authorization: Bearer`). Expires after ~60 days, so
  renewal is a recurring ops task.
- `EDL_USER` / `EDL_PASS` — Earthdata login pair, kept only as a local
  fallback for pipeline runs outside CI.

## Prerequisites owned by humans

These are setup steps, not code: the app runs against local fixtures/mocks
until they exist.

- Vercel project created with the env vars above.
- `GEE_PROJECT` registered for the Earth Engine API with a service account.
- Telegram bot token from BotFather (+ Firestore if persistence is enabled).
