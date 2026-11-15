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
  .
docker run -d --name tp-app --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  --env-file /etc/tipping-point/app.env \
  -v tp-data:/app/.data \
  tipping-point-app
docker ps            # STATUS shows (healthy) after ~20 s
curl -s localhost:3000/api/health      # {"ok":true}
```

The image: bun installs and builds (same lockfile and build as Vercel, the
data sync step skips and keeps the committed `public/data`), then Node 24
runs `next start` as the non-root `node` user. `HEALTHCHECK` calls
`/api/health?live=1` (liveness: 200 `{"ok":true}` whenever the server
answers). Plain `/api/health` is what the uptime monitor and the GitHub
Actions keepalive (`.github/workflows/keepalive.yml`, every 10 minutes,
`https://tippingpoint.l17s.dev/api/health`) poll: 200 `{"ok":true}`, or 503
`{"ok":false}` = **server up but live data older than 6 h** (two missed
3-hourly runs) or unreadable. A failed ping fails the workflow run and GitHub
emails the repo owner. The body never carries the timestamp or any data.

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
| `/api/health` | 200 `{"ok":true}` (503 `{"ok":false}` when the live data is older than 6 h); `?live=1` = liveness |
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
| `APP_URL` | runtime | The new public URL, e.g. `https://tipping-point.example.org` (no trailing slash). |
| `PORT` | runtime | Default `3000`. Match the `-p` mapping and the proxy. |
| `ALERTS_PAUSED` | runtime | Optional `1` pauses the public alerts panel. |
| `NEXT_PUBLIC_REFRESH_HOURS` | **build arg** | Live-run period in hours, default 3. |

## 3. Reverse proxy and TLS

Keep the app private (`127.0.0.1` for a host proxy, or a private Docker
network for a containerized proxy) and put a proxy with TLS in front. The
pages **stream** (Partial Prerendering + Suspense): the proxy must not buffer
responses, or the page waits for the slowest data read.

### Caddy (automatic Let's Encrypt)

The current VPS runs `lucaslorentz/caddy-docker-proxy`, not a host Caddyfile.
`tipping-point-app` is healthy on the private `caddy_proxy` network at port
3000, with its SQLite volume mounted at `/app/.data`. DNS for
`tippingpoint.l17s.dev` points to this VPS. To restore the live route without
restarting the app or touching its volume, use the existing `node:24-slim`
image for a small, portless label carrier:

```bash
docker run -d --name tipping-point-route --restart unless-stopped \
  --network caddy_proxy --user node --read-only --cap-drop ALL \
  --security-opt no-new-privileges --memory 64m --pids-limit 32 \
  --label caddy=tippingpoint.l17s.dev \
  --label caddy.reverse_proxy=tipping-point-app:3000 \
  --label caddy.reverse_proxy.flush_interval=-1 \
  --label caddy_ingress_network=caddy_proxy \
  node:24-slim node -e 'setInterval(() => {}, 1073741824)'
docker inspect tipping-point-route --format '{{.State.Status}} {{json .Config.Labels}}'
docker inspect tipping-point-app --format '{{.State.Health.Status}}'
curl -fsS -o /dev/null https://tippingpoint.l17s.dev/api/health
curl -fsS -o /dev/null https://tippingpoint.l17s.dev/
```

The route container survives Docker restarts, but its creation is still a
manual VPS step; merging this documentation does not create it. Keep the
container name `tipping-point-app` stable across deploys so Docker DNS follows
the replacement. Do not simultaneously set `caddy=tippingpoint.l17s.dev` on
the app in a deploy workflow: choose one owner for the hostname. If moving
the labels to the app, first ensure the replacement app is healthy, then
remove the helper with `docker rm -f tipping-point-route` and validate HTTPS;
restore the helper if the replacement route fails. Publishing the site does
not change `APP_URL`; configure it separately.

For a standalone Caddy installation instead, use a Caddyfile:

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
| Hard-coded `*.vercel.app` URLs | Only in docs (`docs/DEPLOY.md`, `docs/PLAN.md`) and submission links — update to `APP_URL`. Nothing in `src/`. |
| GitHub Actions of the data repo | Unchanged: they publish data, they never call the app. |

Nothing in the app breaks off Vercel; the only required actions are TLS,
and the env file.
