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
| `DATABASE_URL` | Subscriber backend selector, not required locally: unset or `sqlite:<path>` uses local SQLite (default `.data/tipping-point.sqlite`). Infra sets a secret `postgres://` or `postgresql://` Neon connection string in production for server-only HTTPS SQL access. Never expose or commit the production value. |
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

GEE-first architecture: app tiles and numbers resolve through our `/api`
routes against Earth Engine; the static manifest + raw branch copy stays the
fallback contract the app degrades to. Workflows on the data repo:

- `now.yml` — every 3 h (cron `0 */3 * * *`) + `workflow_dispatch`:
  IMERG Early + SMAP L4 + GEOS-FP ingest →
  `tipping-point/now/` asset collections → TPI + D+1..D+3 in GEE → last-good
  static copy on the force-pushed `fallback` branch (`manifest.json` written last).
- `nisar.yml` — daily: `asf_search` for new GCOV granules over the case AOIs
  and active alert areas.
- `validation.yml` — daily: OPERA DSWx + SWOT Hydrocron table asset.
- `reference.yml` — weekly + `workflow_dispatch`: landslide catalogs +
  municipal boundaries.

Freshness copy is “updated X h ago” against the three-hour refresh cadence.
The stale-data warning threshold is **6 h** since the data update timestamp.

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
- Telegram bot token from BotFather.
- Production only: infra creates a free Neon Postgres project with
  `db/schema.sql` applied and server-only `DATABASE_URL` configured in Vercel
  and GitHub Actions secrets. Local development uses automatic SQLite and
  does not wait for Neon infrastructure.
