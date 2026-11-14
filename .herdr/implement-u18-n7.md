# u18-n7 — Defesa Civil footer on every bot message

## Changed
- `src/lib/telegram/bot.ts`: added `withFooter(body)` helper (`body + "\n" + FOOTER`)
  and applied it to every `deps.send` text: cadastro confirmação, /status
  no-location, /simular indisponível, simular intro, each simular step line,
  the "Veja o replay completo" map message, and /parar. /status with a sub is
  composed as `body + (\nMapa: url)? + \nFOOTER` so the map link precedes the
  footer. TERMS already ends with FOOTER — left as is. Helper named
  `withFooter` (not `msg`) because `msg` is already a local in `handleUpdate`.
- `src/lib/telegram/bot.test.ts`: updated expected strings to include the
  footer; added `for (const s of sent) expect(s.text.endsWith(FOOTER))` loops
  in each send-producing test; /status+APP_URL test asserts
  `indexOf("Mapa:") < indexOf(FOOTER)`.

## Commands & results
- `bun install --frozen-lockfile` — 762 packages, clean.
- `bun test` — 318 pass, 6 skip (live GEE smoke), 0 fail.
- `bun run lint` — 0 errors (1100 pre-existing warnings, none in touched files).

## Commit
- `0d1ad30` on `unit/u18-n7` — only the two source files. Not pushed.
