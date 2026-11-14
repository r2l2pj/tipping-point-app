# U10 — CI workflow + deploy docs

## What changed

- `.github/workflows/ci.yml` (new) — single `ci` job on `push` + `pull_request`,
  ubuntu-latest: `actions/checkout@v4`, `oven-sh/setup-bun@v2`,
  `bun install --frozen-lockfile`, `bun run lint`, `bun test --pass-with-no-tests`,
  `bun run build`. No secrets/env; `DATA_REPO` stays unset so `prebuild` sync
  warns and exits 0 when the sibling checkout is absent.
  - Deviation note: the plan said plain `bun test`, but bun 1.4.4 exits 1 on
    "No tests found". `--pass-with-no-tests` exits 0 in that case and still
    exits non-zero on real test failures — keeps CI green before U2's tests
    land without masking failures.
- `docs/gcs-cors.json` (new) — GCS CORS config: `GET` from `["*"]` (bucket is
  public-read anyway), common response headers, `maxAgeSeconds: 3600`.
- `docs/DEPLOY.md` (new) — operator runbook: Vercel import + env vars
  (`DATA_BASE_URL`, `GEE_PROJECT`, `GCP_SA_KEY` per D10 — no
  `GEE_SERVICE_ACCOUNT_KEY`, `TELEGRAM_TOKEN`, `TELEGRAM_SECRET`, `APP_URL`),
  creds-in-env-only rule, public-read GCS bucket + CORS apply command +
  manifest-written-last note, Telegram `setWebhook` curl, and human-owned
  deploy prerequisites.

## Proof

- `bun -e 'Bun.YAML.parse(...)'` on `ci.yml` → parses to expected structure
  (PyYAML not installed locally; bun equivalent used).
- `python3 -c 'import json; json.load(...)'` on `gcs-cors.json` → valid JSON.
- `bun install --frozen-lockfile` → 806 installs checked, no changes.
- `bun run lint` → exit 0, 0 errors (1100 pre-existing warnings in
  `public/maplibre-gl-worker.js` and `src/types/earthengine.d.ts`).
- `bun test --pass-with-no-tests` → "No tests found", exit 0 (plain `bun test`
  exits 1 here — reason for the flag, above).
- `bun run build` → exit 0; `prebuild` synced `../tipping-point-data/data`
  (sibling exists locally; on Vercel/CI it warns + exits 0), `next build`
  compiled, TypeScript clean, all 7 routes generated.

No new dependencies; no secrets; nothing outside the four scoped paths committed.
