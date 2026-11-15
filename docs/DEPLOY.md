# Deploy

Operator runbook for deploying `tipping-point-app` to Vercel. The app reads
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
| `GEE_ENABLED` | Optional, default **off** (L25). `1`/`true` turns on the Earth Engine routes (`/api/tiles`, `/api/layers`, `/api/numbers`, `/api/point`), and the GEE overlay of the case loader. Off: those routes answer 503 `runtime GEE disabled` and `/api/metrics` serves the manifest copy. `/api/health` is a liveness probe: 200 `{"ok":true}` while the server is up. |
| `GEE_PROJECT` | Only with `GEE_ENABLED`: Google Cloud project registered for the Earth Engine API. |
| `GCP_SA_KEY` | Only with `GEE_ENABLED`: service-account JSON key (single line). Server-side only — never `NEXT_PUBLIC_`-prefixed. |
| `DATABASE_URL` | Subscriber backend selector, not required locally: unset or `sqlite:<path>` uses local SQLite (default `.data/tipping-point.sqlite`). Infra sets a secret `postgres://` or `postgresql://` Neon connection string in production for server-only HTTPS SQL access. Never expose or commit the production value. |
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

## Neon setup (one project, two services)

Project `muddy-rice-39176958` hosts both app Neon services:

- **Postgres** — the Telegram subscriber table. `DATABASE_URL` is the
  `postgres://`/`postgresql://` connection string; secret, server-only, lives
  in Vercel env + GitHub Actions secrets on the data repo. Never print or
  commit it. Applied schema is `db/schema.sql` (`subscribers` + RLS).
- **Object Storage** — bucket `tipping-point-data`, declared `public_read` in
  the repo-root `neon.ts` (applied via `@neon/config`; `neon env pull` /
  `neon-env run` manage local env). Anonymous `GET` returns objects; writes
  need the `NEON_S3_ACCESS_KEY_ID` / `NEON_S3_SECRET_ACCESS_KEY` /
  `NEON_S3_REGION` / `NEON_S3_BUCKET` credentials — those are data-repo
  Actions secrets (uploads), **not** app runtime vars. The app only needs
  `NEON_S3_ENDPOINT` to build the anonymous read URL.

## Telegram subscriber store (local SQLite, production Neon)

Only the Telegram subscriber store needs a database. Local development and
tests use SQLite automatically; no Neon project or `DATABASE_URL` is required
locally. Unset `DATABASE_URL` uses the automatic, gitignored file
`.data/tipping-point.sqlite`; `sqlite:<path>` selects an explicit local file.
The app uses `bun:sqlite` under Bun and `node:sqlite` under Node 22 (which
emits an experimental warning); the data pipeline uses Python's stdlib
`sqlite3`. No new dependency is needed.

Both backends share the same store interface and one portable `db/schema.sql`.
Store tests use in-memory SQLite, and the Neon HTTP path is tested against a
fake HTTP server rather than requiring live infrastructure.

For production, the infra person creates a free Neon Postgres project, runs
`db/schema.sql` in its SQL editor, and sets `DATABASE_URL` to its `postgres://`
or `postgresql://` connection string. This switches the backend to Neon.
The Neon `subscribers` table has this schema:

```sql
create table subscribers (
  chat_id text primary key,
  lat numeric(5,2),
  lon numeric(6,2),
  consent bool,
  last_class int,
  last_alert_ts timestamptz,
  current_label text,
  data_date text,
  created_at timestamptz default now()
);
```

Access is server-only using the connection string, with no RLS requirement.
Use Neon's HTTPS SQL endpoint with plain `fetch` in the app and `requests`
in the data pipeline, with no new dependency: `POST https://<host>/sql`,
header `Neon-Connection-String: <DATABASE_URL>`, `Content-Type: application/json`,
and JSON body `{ "query": "<parameterized SQL>", "params": [] }`. Use bound
parameters for subscriber values. Copy the secret `DATABASE_URL` into both
the Vercel environment and the data repo's GitHub Actions secrets; never
expose it to browser code or commit it. If this endpoint proves unreliable,
ask the conductor before adding a driver dependency.

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
- Neon free: scales to zero and wakes on query; no keep-alive is needed.
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
- Production only: infra creates a free Neon Postgres project with
  `db/schema.sql` applied and server-only `DATABASE_URL` configured in Vercel
  and GitHub Actions secrets. Local development uses automatic SQLite and
  does not wait for Neon infrastructure.
- Neon Object Storage bucket `tipping-point-data` provisioned `public_read`
  (`neon.ts` is the declaration; `neon deploy`/`checkout` applies it) as the
  fallback remote; `NEON_S3_ENDPOINT` optional (built-in public URL otherwise).
