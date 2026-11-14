# L10 raw fallback storage

Branch: `unit/l10store`. Base SHA: `0461363e1d9bc832bbd76c701f4fed62093591cc`.

## Changes

- Read Lucas's L10 ruling in `/home/lucascoelho/code/r2l2pj/.crew/plans/decisions.md`.
- `src/lib/data.ts`: default remote base is `https://raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data`; env override and trailing-slash normalization retained. Remote misses still try bundled public/data and flag fallback. Updated bucket comments. Exported API unchanged; resolveAsset and its legacy URI support untouched.
- `src/lib/data.test.ts`: one node:http localhost fixture test covers raw-style nested paths, JSON CORS header, remote manifest/bundle sentinels, trailing-slash normalization, and binary Range response (206, Content-Range, Content-Length, exact bytes). Updated the former fs-only test to intercept the default raw URL offline and assert bundled last-resort behavior.
- `.env.example` and `docs/DEPLOY.md`: describe orphan fallback branch force-pushed each run, data/ tree, EPSG:3857 PNGs + JSON + GeoJSON, manifest last, no COGs; retain GEE credentials and scheduled-job secret guidance. Removed storage setup and staging instructions.
- Deleted `docs/gcs-cors.json` as requested.
- Inspected `scripts/sync-data.mjs`; no bucket/GCS wording, so left unchanged including behavior.

## Commands and results

Verification ran on the above base SHA plus this worktree's L10 changes:

- `bun test`: exit 0; `247 pass`, `6 skip`, `0 fail`, `735 expect() calls`, `Ran 253 tests across 16 files.` Skips are live GEE smoke tests requiring credentials. New fixture uses localhost only; default URL test intercepts fetch and makes no external request.
- `bun run lint`: exit 0; `1100 problems (0 errors, 1100 warnings)`. Warnings are in unchanged vendored public/maplibre-gl-worker.js and src/types/earthengine.d.ts.
- `bun test src/lib/data.test.ts` after final test-label/format cleanup: exit 0; `9 pass`, `0 fail`, `56 expect() calls`.
- `bun run lint --quiet` after final cleanup: exit 0, no findings.
- `git diff --check`: exit 0.
- Reviewed `git diff`, `git status --short`, and `git log -3 --oneline` before committing.

L10 committed as `8d14184c844befb2133435113f9fa9f47d98142d` with the requested message and Devin trailer. Initial staging command named the already-staged deleted CORS file and returned pathspec-not-found; retried staging the remaining four files successfully, retaining the staged deletion.

## Authorized L11/L12 scope extension

Read L11/L12 in decisions.md. Changed only `.env.example` and `docs/DEPLOY.md` in this extension:

- Added empty SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY placeholders and REST/PostgREST, no-SDK, server-only secret guidance.
- Added free Supabase project setup via `supabase/schema.sql`, exact requested subscribers schema, RLS/service-role-only writes, Vercel env + GitHub secrets setup, and unchanged LGPD rounding/consent/deletion rules.
- Replaced the sole Firestore prerequisite; there were no Firestore/FIREBASE env placeholders to remove.
- Added free-tier constraints including GEE non-commercial, public GitHub Actions, small raw fallback files, Vercel Hobby maxDuration within plan limits, and Supabase seven-idle-day pause/three-hourly job activity.
- `supabase/schema.sql` and the actual subscriber implementation are outside this unit's write scope; this extension only documents the agreed setup contract.

Verification on L10 SHA `8d14184c844befb2133435113f9fa9f47d98142d` plus the L11/L12 documentation changes:

- `bun test`: exit 0; `247 pass`, `6 skip`, `0 fail`, `735 expect() calls`, `Ran 253 tests across 16 files. [2.94s]`.
- `bun run lint --quiet && git diff --check && git diff --stat`: exit 0; lint no errors; only .env.example and docs/DEPLOY.md changed in extension.
- Search `Firestore|FIREBASE|GCS|gs://|bucket` in docs/DEPLOY.md: no matches.
- Reviewed `git diff -- .env.example docs/DEPLOY.md`.

No dependency changes, no push, no fallback-branch publishing operations. This unit documents the data-repo publish and subscriber setup contracts; it does not implement those pipelines or provision services.
