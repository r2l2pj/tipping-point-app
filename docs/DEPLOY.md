# Deploy

Operator runbook for deploying `tipping-point-app` to Vercel with live data
served from a public-read GCS bucket.

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
| `DATA_BASE_URL` | Base URL of the public-read GCS bucket holding the data artifacts. At runtime the app fetches manifests/JSON from this URL; when unset it falls back to the bundled `public/data`. |
| `GEE_PROJECT` | Google Cloud project registered for the Earth Engine API. |
| `GCP_SA_KEY` | Service-account JSON key (single line) for Earth Engine access. Server-side only — never `NEXT_PUBLIC_`-prefixed. |
| `TELEGRAM_TOKEN` | Bot token from BotFather, used to call the Telegram Bot API. |
| `TELEGRAM_SECRET` | Shared secret Telegram sends as `X-Telegram-Bot-Api-Secret-Token`; the webhook route verifies it. |
| `APP_URL` | Canonical public URL of the deployment (e.g. `https://<project>.vercel.app`), used to register the webhook. |

## Live data bucket (GCS)

The app reads `DATA_BASE_URL` at request time, so updating data does not
require a redeploy. Setup:

1. Create a GCS bucket and make it public-read
   (`allUsers` → `roles/storage.objectViewer`).
2. Apply CORS so the deployed app (and local dev) can fetch it from the
   browser. `docs/gcs-cors.json` allows `GET` from any origin with common
   response headers — sufficient because every object is already public:

   ```bash
   gcloud storage buckets update gs://<bucket> --cors-file=docs/gcs-cors.json
   ```

3. The data pipeline publishes the `now/` tree and per-case directories to the
   bucket and writes `manifest.json` **last**, so readers never observe a
   half-updated artifact set.
4. Point `DATA_BASE_URL` at the bucket's public base
   (`https://storage.googleapis.com/<bucket>`).

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
routes against Earth Engine; the static manifest + bucket export stays the
fallback contract the app degrades to. Workflows on the data repo:

- `now.yml` — every 3 h: IMERG Early + SMAP L4 + GEOS-FP ingest →
  `tipping-point/now/` asset collections → TPI + D+1..D+3 in GEE → last-good
  static export to the bucket (`manifest.json` written last).
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

## GEE asset ingestion (staging)

Pipeline rasters ingest into Earth Engine via the data bucket's staging
prefix: upload to `gs://<bucket>/staging/...`, then
`ee.data.startIngestion` / `ee.data.startTableIngestion` into
`projects/<GEE_PROJECT>/assets/tipping-point/<case>/`. The ingest service
account needs `Storage Object Admin` on the bucket plus
`Earth Engine Resource Writer` on the project.

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
- GCS bucket created, public-read granted, CORS applied.
