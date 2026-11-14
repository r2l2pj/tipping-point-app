# u17-gate

## Change

`src/lib/ee.smoke.test.ts`: live-smoke credential gate now treats
`GOOGLE_APPLICATION_CREDENTIALS` (path to the SA key JSON file) as a
first-class credential, matching `credentialEnv()`/`loadServiceAccount()`
in `src/lib/ee.ts`.

- `HAS_CREDS` is true when `GCP_SA_KEY` OR `GEE_SERVICE_ACCOUNT_KEY` OR
  `GOOGLE_APPLICATION_CREDENTIALS` is set AND `GEE_PROJECT` is set.
- Skip `console.log` names all three env vars.
- Bottom "how to run" comment gains the path-based variant
  `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json GEE_PROJECT=hermes-fesolucoes bun test src/lib/ee.smoke.test.ts`
  (placeholder path only) and a one-line note that it holds a file path.

No new deps. No other files touched.

## Commands run

- `bun install --frozen-lockfile` — ok (762 packages)
- `bun test` — 317 pass, 6 skip (the gee smoke tests, no cred env), 0 fail
- `bun run lint` — 0 errors (pre-existing warnings elsewhere)
- `npx eslint src/lib/ee.smoke.test.ts` — clean, exit 0
