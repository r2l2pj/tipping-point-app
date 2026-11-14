# u17-gac — GOOGLE_APPLICATION_CREDENTIALS as third credential source

Commit: `dc03408` on `unit/u17-gac` (not pushed)

## Changed

- `src/lib/ee.ts`
  - `SA_KEY_ENVS` now `["GCP_SA_KEY", "GEE_SERVICE_ACCOUNT_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS"]`; `CredentialEnv` union widens
    automatically. `credentialEnv()` returns them in that priority order.
  - New exported `loadServiceAccount(): Promise<{env, privateKey}>`:
    inline-JSON envs are `JSON.parse`d; `GOOGLE_APPLICATION_CREDENTIALS` is
    read as a file path via `node:fs/promises` `readFile`, then parsed.
    Every failure throws an `Error` naming the env var + reason
    ("not valid JSON" / "key file is missing or unreadable") — never the
    path or contents. No logging added.
  - `earthEngine()` calls `loadServiceAccount()`; the no-creds message now
    lists all three envs. Memoized-init + reset-on-failure unchanged.
  - `privateKey` cast to `Parameters<typeof
    ee.data.authenticateViaPrivateKey>[0]` (`Record<string, unknown>` isn't
    assignable to the SDK's `PrivateKey`).
- `src/lib/ee.test.ts` (new) — 9 tests over `credentialEnv` /
  `loadServiceAccount` with `mkdtemp` fixtures; asserts priority order,
  file read+parse, and that error messages contain the env name but not
  path/contents. `earthEngine()`/`authenticate` untouched (needs real
  creds).
  - Gotcha solved: `ee-tiles.test.ts` registers a registry-wide
    `mock.module("./ee")` stub that leaks into this file's imports, and
    bun's `mock.restore()` does NOT remove module mocks (no `vi.doUnmock`
    exists in bun 1.4.4). Tests import via `import("./ee" + "?real")` —
    the query suffix bypasses the mock registry; non-literal specifier so
    tsc doesn't try to resolve it.

## Verified

- `bun test` — 317 pass, 6 skip, 0 fail (was 3 fail mid-iteration due to
  the mock leak above).
- `bun run build` — TypeScript + compile pass. **Prerender of `/alerts`
  fails on base too**: data.ts fetches
  `raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data/manifest.json`
  → HTTP 404 (branch has no manifest). Reproduced with the change stashed
  → identical failure, so pre-existing/environmental, not caused by this
  unit. (`DATA_REPO=/home/lucascoelho/code/r2l2pj/tipping-point-data`
  needed since the worktree isn't a sibling of the data repo.)
- `bun run lint src/lib/ee.ts src/lib/ee.test.ts` — clean.

## Callers checked

All `credentialEnv()` consumers compare presence (`!credentialEnv()`,
`!== null`) or echo the name (`api/ee/status`); none narrow on the old
union — the wider `CredentialEnv` is backward compatible.
