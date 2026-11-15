# Deploy

Vercel compatibility runbook for `tipping-point-app`; the canonical production
deployment target is the VPS (`docs/DEPLOY-VPS.md`). The app reads
static data files (L26): the public GitHub data branch first, the Neon bucket
as fallback, the bundled copy last. Earth Engine is not on any runtime path by
default (L25) — it is opt-in with `GEE_ENABLED`.

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
| `DATA_BASE_URL` | Leave **unset** in production. Optional override: when set it is the ONLY remote source (tests pin it unreachable to force the bundled copy). Unset, reads go GitHub `fallback` branch → Neon bucket → bundled copy. |
| `NEON_S3_ENDPOINT` | Optional. Neon Object Storage endpoint (`https://...`) for the FALLBACK remote `https://<endpoint>/tipping-point-data/data/`; unset uses the built-in public bucket URL. Not a secret — never a credential. |
| `GEE_ENABLED` | Optional, default **off** (L25). `1`/`true` turns on the Earth Engine routes (`/api/tiles`, `/api/layers`, `/api/numbers`, `/api/point`), the GEE overlay of the case loader and the health probe. Off: those routes answer 503 `runtime GEE disabled`, `/api/metrics` serves the manifest copy, and `/api/health` is ok when the data manifest is readable with a parseable `now` stamp. |
| `GEE_PROJECT` | Only with `GEE_ENABLED`: Google Cloud project registered for the Earth Engine API. |
| `GCP_SA_KEY` | Only with `GEE_ENABLED`: service-account JSON key (single line). Server-side only — never `NEXT_PUBLIC_`-prefixed. |
| `DATABASE_URL` | Vercel legacy webhook: Neon URL until cutover. VPS after cutover: `sqlite:/app/.data/tipping-point.sqlite`, backed by the persistent `tipping-point-data` volume shared with the notifier worker. Do not point a Vercel runtime at the VPS SQLite path. Keep Neon only through the reviewed migration/recovery window; never expose or commit it. |
| `TELEGRAM_TOKEN` | Bot token from BotFather, used to call the Telegram Bot API. |
| `TELEGRAM_SECRET` | Shared secret Telegram sends as `X-Telegram-Bot-Api-Secret-Token`; the webhook route verifies it. |
| `APP_URL` | Canonical public URL of the deployment (e.g. `https://<project>.vercel.app`), used to register the webhook. |

## Data availability

GitHub is the data store (L26). Read order, per file:

1. **GitHub `fallback` branch (primary)** — orphan branch of
   `r2l2pj/tipping-point-data`, read at
   `https://raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data/`.
   The 3-hourly `now.yml` job publishes it with `GITHUB_TOKEN` as one
   force-pushed commit per run (no history growth), app-facing files only,
   `manifest.json` written last. Files > 50 MB go to a GitHub Release asset.
   raw.githubusercontent caches ~5 min; the app tolerates that.
2. **Neon Object Storage (fallback)** — public-read bucket `tipping-point-data`
   (`neon.ts` declares it; CORS allows `GET`/`HEAD`), at
   `${NEON_S3_ENDPOINT}/tipping-point-data/data/` or the built-in public URL.
3. **Bundled `public/data`** — committed copy synced by `bun run sync:data`;
   the last resort when every remote read misses.

Browser assets (PNG frames, COGs, lazy GeoJSON) resolve against the remote
that served the root manifest, so a GitHub outage serves frames from Neon too.
The "Showing last saved data" status appears only when the root manifest came
from the bundled copy, or when live data is older than 6 h — never because a
single optional file is missing. `DATA_BASE_URL` stays an explicit override
(sole remote source), read at request time; updating data never needs a
redeploy.

## Neon Object Storage

Project `muddy-rice-39176958` hosts the app's fallback object bucket:

- **Object Storage** — bucket `tipping-point-data`, declared `public_read` in
  the repo-root `neon.ts` (applied via `@neon/config`; `neon env pull` /
  `neon-env run` manage local env). Anonymous `GET` returns objects; writes
  need the `NEON_S3_ACCESS_KEY_ID` / `NEON_S3_SECRET_ACCESS_KEY` /
  `NEON_S3_REGION` / `NEON_S3_BUCKET` credentials — those are data-repo
  Actions secrets (uploads), **not** app runtime vars. The app only needs
  `NEON_S3_ENDPOINT` to build the anonymous read URL.

## Telegram subscriber store (SQLite)

Only the Telegram subscriber store needs a database. Local development and
tests use SQLite automatically. The legacy Vercel webhook uses Neon until it
is moved to the VPS. After the reviewed cutover, the VPS uses
`sqlite:/app/.data/tipping-point.sqlite` inside the persistent
`tipping-point-data` Docker volume. The notifier worker mounts that same volume
and uses Python's stdlib `sqlite3`; the app uses `node:sqlite`. Both enable WAL
and a 5-second busy timeout for concurrent access. No public database port is
opened.

The app and worker use the same `subscribers` schema. The data repository's
`scripts/migrate_neon_to_sqlite.py` copies every Neon row, including
non-consenting rows and alert state, into an **empty** SQLite target in one
transaction; it refuses an empty source or a non-empty target. Run it only
during the reviewed VPS cutover, after taking an off-host backup. Keep the
Neon source unchanged until row counts and a real Telegram `/status` check are
verified. Full ordered cutover/rollback steps are in
`tipping-point-data/docs/VPS-SQLITE.md`.

LGPD rules are unchanged: round coordinates to two decimal places, record
the consent flag, and delete the subscriber row on `/parar`.

## Free-tier limits

All runtime services must stay on free tiers; no paid plan is required.

- GEE: non-commercial access.
- GitHub Actions: public-repo workflows.
- `raw.githubusercontent.com`: fallback small files only; no large COGs.
- Neon Object Storage: free-tier object reads on the public bucket; anonymous
  `GET` only from the app (no credentials in browser or server reads).
- Vercel Hobby: set API routes' `maxDuration` within the plan's function
  duration limit.

- Earthdata and Telegram Bot API: use their free access.

## Telegram webhook

After the app is deployed and `TELEGRAM_TOKEN` / `TELEGRAM_SECRET` / `APP_URL`
are set, register the webhook once:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/setWebhook" \
  -d url="$APP_URL/api/telegram" \
  -d secret_token="$TELEGRAM_SECRET"
```

## Scheduled jobs (GitHub Actions)

No GEE at runtime (L25): the app serves the static files above; Earth
Engine is only hosted copies + one-off compute. Workflows on the data repo:

- `now.yml` — every 3 h (cron `0 */3 * * *`) + `workflow_dispatch`:
  IMERG Early + SMAP L4 + NOAA GFS forecast rain fetched directly
  (Earthdata / NOAA open data), TPI computed in the job, P(trigger) frames,
  published to the force-pushed `fallback` branch (`manifest.json` written
  last; L26).
- `nisar.yml` — daily: `asf_search` for new GCOV granules over the case AOIs
  and active alert areas.
- `validation.yml` — daily: OPERA DSWx + SWOT Hydrocron table asset.
- `reference.yml` — weekly + `workflow_dispatch`: landslide catalogs +
  municipal boundaries.

Freshness copy is “updated X h ago” against the three-hour refresh cadence.
The stale-data warning threshold is **6 h** since the data update timestamp.

### Command Center settings

Two public settings, read by the Command Center screen. Both are optional.

| Variable | Default | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_REFRESH_HOURS` | `3` | Refresh period of the live run in hours. The screen calls the live data "stale" after two periods (6 h by default). Change it together with the cron of `now.yml`. |
| `NEXT_PUBLIC_TELEGRAM_BOT_URL` | unset | Address of the Telegram bot, for example `https://t.me/<bot>`. When unset, the "Get alerts on Telegram" card is not shown. |

`NEXT_PUBLIC_*` values are fixed at build time: redeploy after a change.

A scripted browser pass over the screen lives in
`scripts/command-center-check.mjs` (not a CI job). Its header lists the
settings.

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

- Vercel project created with the env vars above (`DATA_BASE_URL` unset,
  `GEE_ENABLED` unset).
- Optional: `GEE_PROJECT` registered for the Earth Engine API with a service
  account, only if `GEE_ENABLED` is turned on.
- Telegram bot token from BotFather.
- Legacy Vercel webhook only: keep Neon Postgres and its server-only
  `DATABASE_URL` until the reviewed VPS SQLite cutover finishes. Local
  development uses automatic SQLite and does not wait for Neon infrastructure.
- Neon Object Storage bucket `tipping-point-data` provisioned `public_read`
  (`neon.ts` is the declaration; `neon deploy`/`checkout` applies it) as the
  fallback remote; `NEON_S3_ENDPOINT` optional (built-in public URL otherwise).
