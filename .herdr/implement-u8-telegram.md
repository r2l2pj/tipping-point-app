# implement — U8 Telegram bot webhook

Cred-blocked Telegram alerting channel for Tipping Point, ported from the
project doc's `api/telegram.py` concept to a Next.js route handler. Fully
coded and tested without credentials or new dependencies.

## Files

- `src/app/api/telegram/route.ts` — `POST` webhook. 503 `{telegram:"unconfigured"}`
  when `TELEGRAM_SECRET`/`TELEGRAM_TOKEN` unset → 403 on missing/wrong
  `x-telegram-bot-api-secret-token` → 400 on invalid JSON → always `200 {ok:true}`
  after auth (handler errors logged, never returned, so Telegram can't
  retry-storm).
- `src/lib/telegram/bot.ts` — pure `handleUpdate(update, deps)` + all PT-BR
  copy (`TERMS`, `FOOTER`). Commands: `/start` (terms + request_location
  keyboard), location share (rounds to 2 decimals, stores consent), `/status`
  (registered/unregistered branches, `Mapa:` line only when `APP_URL` set),
  `/simular` (intro + ordered `Encantado` steps + map link, graceful
  "Simulação indisponível no momento." on source failure), `/parar` (delete +
  confirm). LGPD: "sua região" everywhere, ~1 km rounding.
- `src/lib/telegram/store.ts` — `Subscriber`, `SubscriberStore`, `MemoryStore`
  (Map-backed; default export is a singleton).
- `src/lib/telegram/firestore-store.ts` — `FirestoreStore` over the REST client;
  collection `subscribers`, doc `subscribers/<chatId>`, project from SA
  `project_id`.
- `src/lib/telegram/deps.ts` — memoized `depsFromEnv()`:
  `send` = POST `sendMessage` (10 s timeout); store = `FirestoreStore` when
  `GCP_SA_KEY` set else the `MemoryStore` singleton; `fetchSimular` =
  `TELEGRAM_SIMULAR_URL` → `public/data/rs_2024/simular.json` →
  `public/data/simular.json`.
- `src/lib/firestore-rest.ts` — zero-dep Firestore REST: `serviceAccountToken`
  (RS256 JWT-bearer grant via `node:crypto`, cached per `client_email` until
  exp−60 s) + `getDocument`/`setDocument` (PATCH)/`deleteDocument` on the v1
  REST endpoint + minimal `toFsFields`/`fromFsFields` codec.
- `src/lib/telegram/{bot,route,firestore-rest}.test.ts` — 22 tests, no
  network, no deps.

## Commands & results

- `bun test src/lib/telegram` → 22 pass / 0 fail / 53 expects (137 ms).
- `./node_modules/.bin/tsc --noEmit` → zero errors in my files.
- `bun run build` (runs `sync:data`, then `next build`) → green; `/api/telegram`
  listed as dynamic route.
- `eslint` on all created files → clean (0 problems).

## Deviations / interpretations

1. **`bun:test` types**: `bun-types` isn't a dependency, so the bare
   `import from "bun:test"` fails `next build` typecheck (TS2307). Followed the
   pattern another unit already established in `src/lib/contract.test.ts`:
   a two-line `// @ts-expect-error -- bun:test resolves under bun test…`
   comment above the import. Build is green.
2. **`/simular` outro**: spec's "(line only when APP_URL set)" is ambiguous —
   implemented as a final separate `sendMessage` (`Veja o replay completo no
   mapa: <APP_URL>`), matching the per-step send-per-line pattern.
3. `serviceAccountToken`/`getDocument` etc. accept the SA as parsed object or
   JSON string (`FirestoreStore` gets `JSON.parse(GCP_SA_KEY)` per spec).
4. `depsFromEnv()` reads `APP_URL` indirectly — the bot reads
   `process.env.APP_URL` at message time (deps object kept exactly to the
   `{send, store, fetchSimular}` spec).

## Not committed / not touched

`.env.example`, `package.json`, `docs/`, `public/`, and all existing files left
untouched per scope. Other leads' in-flight files (`contract.ts`, `types.ts`,
etc.) were dirty in the tree during the build — the final `bun run build` was
green with them anyway.
