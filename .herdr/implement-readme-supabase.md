# implement-readme-supabase

Commits on `unit/readme-supabase` (README.md only):
- `89dfe5d` — "README: Supabase subscriber store per L11/L12" (superseded)
- `eab9125` — "README: Neon subscriber store + 6h cadence per L12b/L13"
- `5008546` — "README: DATA_BASE_URL is the raw fallback branch, not a bucket (L10)" (current)

Reviewer catch fixed in `5008546`: Deploy line now reads "Live-data
fallback (`DATA_BASE_URL` -> `raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback`)"
— no GCS bucket per L10.

## Changes (README.md only, reworked for L12b/L13)

1. Seams table, Telegram row (line 32): "Telegram bot webhook + Neon (free)
   subscriber store via HTTPS SQL endpoint (plain fetch, no dep) — 503 until
   `TELEGRAM_TOKEN` + `TELEGRAM_SECRET` are set (cred-blocked)".
   Note: `src/lib/telegram/` still contains Firestore code — the migration
   is a separate unit; README documents the L12b ruling.
2. Credentials section (lines 54-58): `DATABASE_URL` (Neon connection
   string, server-only) in Vercel env + GitHub secrets, never in repos;
   added to the "Full env list" pointer. No RLS/service-role wording
   (connection-string access per L12b).
3. Deploy section (lines 42-44): free-tier line lists Neon free (GEE
   non-commercial, GitHub Actions, Vercel Hobby, Earthdata, Telegram Bot
   API, Neon free); added "The `now.yml` live job refreshes data every 6 h;
   the stale-data warning threshold is 12 h." (L13).
4. No LGPD wording added or changed (README had none).

## Self-check

- `grep -in "firestore" README.md` → no hits.
- `grep -in "supabase" README.md` → no hits.
- `grep -in "neon\|DATABASE_URL\|every 6" README.md` → lines 32, 42, 44,
  54, 58.
- `git status --porcelain` → only `README.md` modified. docs/PLAN.md,
  docs/DEPLOY.md, submission/, src/ untouched.
