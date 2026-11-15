# Deploy on a VPS (L39)

Production moves from Vercel to our own VPS. The app is one Next.js 16
server (`next start`) in a Docker image. **Data does not move**: the server
reads the published files from the `fallback` branch of
`r2l2pj/tipping-point-data` (GitHub raw), then the Neon bucket, then the
copy bundled in the image (`public/data`). The 3-hourly data job keeps
publishing there; a data update never needs an app redeploy.

## 1. Build and run

Needs Docker (or Podman) and internet at build time (bun packages, Google
Fonts are downloaded by `next build` and then served by the app itself).
The build fits in 4 GB (it was built here under a 4 GB cap); plan ~0.5 GB
for the running server. On a small
VPS, build on another machine and `docker save | ssh vps docker load`.

```bash
git clone https://github.com/r2l2pj/tipping-point-app.git && cd tipping-point-app
git checkout freeze-1300            # or main
docker build -t tipping-point-app \
  --build-arg NEXT_PUBLIC_TELEGRAM_BOT_URL=https://t.me/<bot> \
  .
docker run -d --name tp-app --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  --env-file /etc/tipping-point/app.env \
  -v tipping-point-data:/app/.data \
  tipping-point-app
docker ps            # STATUS shows (healthy) after ~20 s
curl -s localhost:3000/api/health | head -c 400
```

The image: bun installs and builds (same lockfile and build as Vercel, the
data sync step skips and keeps the committed `public/data`), then Node 24
runs `next start` as the non-root `node` user. `HEALTHCHECK` calls
`/api/health`, which answers 200 JSON whenever the server is up (the body is
the report: env presence, manifest freshness), so it is a liveness check.

Update: `git pull && docker build … && docker rm -f tp-app && docker run …`
(a few seconds of downtime; fine for one instance).

Podman works the same (`podman build --format docker …`: the default OCI
format drops `HEALTHCHECK`).

### Verified locally (2026-11-15, fix/cc-feedback 09bc8fe, Podman 6.1.4)

```bash
podman build --format docker --memory 4g -t tipping-point-app:smoke .   # 84 s cold, exit 0; image 1.09 GB
podman run -d --name tp-smoke --memory 1g -p 127.0.0.1:3125:3000 tipping-point-app:smoke
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" http://127.0.0.1:3125/<path>
podman healthcheck run tp-smoke; podman inspect tp-smoke --format "{{.State.Health.Status}}"
podman rm -f tp-smoke
```

| Check | Result |
| --- | --- |
| `/api/health` | 200, 523 B, up 2 s after start; `ok: true`, GEE disabled, manifest read from GitHub raw (cases updated 13:08Z) |
| `/` | 200, 282 KB (first request 2.8 s, cold cache) |
| `/alerts` | 200, 280 KB |
| `/?case=rs_2024`, `/?case=wa_2025` | 200, 291 KB / 297 KB; RS page shows the onset row ("36.5% of 16,027") |
| Healthcheck | `healthy` |
| Runtime | Node v24.22.3, uid 1000 (`node`), ~150 MB RSS idle |
| SQLite fallback | `node:sqlite` opens and writes `/app/.data` |

## 2. Environment

Put runtime variables in `/etc/tipping-point/app.env` (mode 600, root-owned,
never in the repo). `NEXT_PUBLIC_*` are inlined into the browser bundle, so
they are **build** arguments, not runtime env.

| Variable | When | Value |
| --- | --- | --- |
| `DATA_BASE_URL` | runtime | **Leave unset.** Unset already reads the GitHub raw `fallback` branch first (`https://raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data/`), then Neon, then the bundled copy. Setting it makes that URL the ONLY remote (no Neon fallback) — set it to the GitHub raw URL only if Neon must be skipped. |
| `NEON_S3_ENDPOINT` | runtime | Optional, not a secret. Unset = built-in public bucket URL. |
| `GEE_ENABLED` | runtime | **Unset** (L25: no Earth Engine at runtime). `GEE_PROJECT`, `GCP_SA_KEY` stay unset too. |
| `DATABASE_URL` | runtime | `sqlite:/app/.data/tipping-point.sqlite`; the notifier worker shares the `tipping-point-data` volume. Keep that volume and back it up off-host or subscriber state is lost with the VPS. |
| `TELEGRAM_TOKEN` | runtime | Bot token (BotFather). Secret. |
| `TELEGRAM_SECRET` | runtime | Webhook shared secret (Telegram sends it as `X-Telegram-Bot-Api-Secret-Token`). Secret. |
| `APP_URL` | runtime | The new public URL, e.g. `https://tipping-point.example.org` (no trailing slash). |
| `PORT` | runtime | Default `3000`. Match the `-p` mapping and the proxy. |
| `ALERTS_PAUSED` | runtime | Optional `1` pauses the public alerts panel. |
| `NEXT_PUBLIC_TELEGRAM_BOT_URL` | **build arg** | `https://t.me/<bot>`; unset hides the Telegram card. |
| `NEXT_PUBLIC_REFRESH_HOURS` | **build arg** | Live-run period in hours, default 3. |

### Telegram webhook moves with the URL

Telegram still posts to the old Vercel URL until the webhook is re-registered
against the VPS. Before moving it, finish the reviewed Neon-to-SQLite copy,
verify subscriber records and deploy the app with the persistent
`tipping-point-data` volume and SQLite URL. Follow the full maintenance-window
sequence in `tipping-point-data/docs/VPS-SQLITE.md`; do not accept new
registrations or deletions in an empty database. After TLS works:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/setWebhook" \
  -d url="$APP_URL/api/telegram" -d secret_token="$TELEGRAM_SECRET"
curl -s "https://api.telegram.org/bot$TELEGRAM_TOKEN/getWebhookInfo"   # url = new one, no last_error
```

## 3. Reverse proxy and TLS

Bind the container to `127.0.0.1` and put a proxy with TLS in front. The
pages **stream** (Partial Prerendering + Suspense): the proxy must not buffer
responses, or the page waits for the slowest data read.

### Caddy (automatic Let's Encrypt)

```caddyfile
tipping-point.example.org {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000 {
		flush_interval -1
	}
}
```

### nginx (+ certbot)

```nginx
server {
    listen 443 ssl http2;
    server_name tipping-point.example.org;
    ssl_certificate     /etc/letsencrypt/live/tipping-point.example.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tipping-point.example.org/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;          # streaming (PPR / Suspense)
        proxy_read_timeout 60s;
    }
}
server { listen 80; server_name tipping-point.example.org; return 301 https://$host$request_uri; }
```

`sudo certbot --nginx -d tipping-point.example.org` issues and renews the
certificate.

## 4. Caching without the Vercel CDN

- `/_next/static/*` carries `public, max-age=31536000, immutable` from Next
  itself: browsers cache it; the proxy may too.
- Pages are a prerendered shell plus data streamed per request (Partial
  Prerendering): the data part renders on the server for every view. That
  is cheap: the data reads go through Next's `"use cache"`
  (in memory, minutes), so GitHub raw is hit at most every few minutes per
  file, not per visitor. A restart empties that cache; the first views after
  it are slower.
- `s-maxage` headers exist only on the Earth Engine API routes, which are
  off (`GEE_ENABLED` unset). Without a CDN they do nothing.
- Map PNG frames load straight from GitHub raw / Neon in the browser, not
  through the VPS, so the VPS bandwidth stays small.
- One instance only. Several instances would need a shared cache handler
  and the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build time (Next
  self-hosting guide).

## 5. What was Vercel-only (audit, 2026-11-15)

| Item | Off Vercel |
| --- | --- |
| `vercel.json` (`git.deploymentEnabled`, `ignoreCommand`) | Ignored. It only controlled Vercel's auto-deploys; no crons, rewrites or headers in it. The VPS has no auto-deploy: redeploy by hand or from CI (section 1). |
| `export const maxDuration` in 10 API routes | Ignored by `next start` (no function time limit on a VPS). Harmless. |
| Edge runtime, `@vercel/*` packages, Vercel KV/Blob, `VERCEL_URL` | None used. |
| `next/image` (needs `sharp` self-hosted) | Not used. |
| `next/font/google` | Downloaded at **build** time → the build host needs internet; fonts are then served by the app. |
| Streaming / PPR | Works with `next start`; the proxy must not buffer (section 3). |
| Data cache (`"use cache"`) | In memory per process (section 4). |
| Telegram webhook URL | Points at the old Vercel URL until re-registered (section 2). |
| SQLite subscriber store (`node:sqlite`) | Needs Node ≥ 22.13 (image: Node 24) and the persistent `/app/.data` volume. After the reviewed cutover, app and notifier share `tipping-point-data`. |
| Hard-coded `*.vercel.app` URLs | Only in docs (`docs/DEPLOY.md`, `docs/PLAN.md`) and submission links — update to `APP_URL`. Nothing in `src/`. |
| GitHub Actions of the data repo | Unchanged: they publish data, they never call the app. |

Nothing in the app breaks off Vercel; the only required actions are TLS,
the env file, and the Telegram webhook.
