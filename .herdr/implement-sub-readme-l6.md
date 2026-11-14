# implement: sub-readme-l6

## Changed

- `README.md` only. Added a `## Credentials` section between `## Deploy`
  and `## Replay forecast` (lines 41-50). Contents per plan ruling L6
  (`.crew/plans/decisions.md` row L6):
  - Earthdata auth = bearer token via env var + GitHub secret
    `EARTHDATA_TOKEN` (name earthaccess reads natively); tokens expire
    ~60 days, renew before judging ends, live cron `now.yml` fails loudly.
  - `EDL_USER`/`EDL_PASS` = local-only fallback, never in secrets.
  - Pointer to `docs/DEPLOY.md` for the full env list (`GCP_SA_KEY`
    canonical; `GEE_SERVICE_ACCOUNT_KEY` fallback).
- Nothing else in the file changed. Note: `now.yml` lives in the sibling
  tipping-point-data repo (this repo has only `ci.yml`); referenced by
  name only, as the plan specified.

## Commands run + results

- `grep -n "L6|Earthdata|EARTHDATA|EDL" ~/code/r2l2pj/.crew/plans/decisions.md`
  → row L6 at line 58 (bearer-token ruling).
- `ls .github/workflows/` → `ci.yml` only (confirms now.yml is the data
  repo's cron).
- `grep -n "EDL_USER" README.md` → single hit, line 46, inside the
  fallback sentence. PASS.
- `grep -c "EARTHDATA_TOKEN" README.md` → 2 (≥ 2). PASS.

## Commit

- `git add README.md .herdr/implement-sub-readme-l6.md && git commit -m
  "README: Earthdata bearer-token creds note (L6)" ...`
