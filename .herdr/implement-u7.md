# U7: /alerts from now/alerts.json candidates + held/quiet rules

## What changed

### `src/lib/alerts.ts` (new)
Pure helpers mapping `NowAlertCandidate[]` (now/alerts.json) onto `Alert[]`
card data — the v4 "Mensagem de alerta" flow. No next/maplibre imports.

- `levelForClass(c)` — defensive dual-scale mapping. Integers read as the 0-3
  class index (2 Alto → `warning`, 3 Crítico → `emergency`, 0-1 suppressed);
  fractional values read as 0-1 TPI floats (>=0.6 → `emergency`, 0.4-0.6 →
  `warning`). Below Alto → `undefined` (upgrade only Alto/Crítico).
- `isQuietHourBRT(d)` — true inside 23:00-06:00 America/Sao_Paulo via
  `Intl.DateTimeFormat` (`hourCycle: "h23"`, `% 24` for safety).
- `candidatesToAlerts(cands, ctx)` — skips below-Alto candidates; builds
  `AlertCardData` (Alert + optional `title`, `held`, `quiet`):
  - `title`: `Tipping Point: {CRITICAL|HIGH|ELEVATED} {hazard} risk`
    (level word shared with the card via `ALERT_LEVEL_WORDS`).
  - `hazard` from label text (flood/enchente/inunda → flood; landslide
    default).
  - `region`/`area`: nearest named place to the centroid via `nearestPlace`
    (injected `ctx.places` FC; rivers excluded upstream), fallback
    "monitored region".
  - `certainty`: pixels >=50 high, >=10 medium, else low.
  - `held`: `hold === true` OR warning issued during quiet hours; `quiet`:
    emergency issued during quiet hours (Crítico still shows, flagged in
    guidance).
  - `valid_from`/`valid_to`: issue time (`ctx.issuedAt`, defaults to now) →
    +12 h, ISO strings.
  - `guidance`: en-US, "your region" (never "your home"), ends
    `ALERT_FOOTER` = "Follow Civil Defense guidance. SMS 40199."
  - `data_dates` passthrough from `ctx.dataDates`.
- `heldLabel(alert|candidate)` — returns "held" when `hold`/`held` set.
- `alertDataDates(dd)` — string-only projection of `DataDates` (drops nulls
  and `NisarPass[]`) for `Alert.data_dates`.

### `src/lib/alerts.test.ts` (new)
13 tests: int class mapping (Alto→warning, Crítico→emergency,
Baixo/Moderado suppressed), float-class variants (0.39/0.4/0.55/0.6/0.9 and
out-of-range/NaN/undefined), quiet-hour edges (22:59/23:00/05:59/06:00 BRT),
below-Alto skipped, title/region/hazard, certainty thresholds, +12 h valid
window, hold→held + heldLabel, quiet-hours held/flag split, every generated
guidance contains "your region", never "your home", ends with SMS 40199
footer; alertDataDates string-only projection.

### `src/app/alerts/page.tsx`
- Loads the live bundle via existing `getCaseBundle("now", ...)`. The
  bundle reference_date is derived from the root manifest
  (`getRootManifest()` → `cases.now.updated_at.slice(0,10)`, literal
  "2026-11-14" only as fallback) — mirrors the u4 fix; review follow-up.
- When `bundle.nowAlerts.candidates` is present it
  maps via `candidatesToAlerts` (places ← `bundle.places ?? bundle.municipalities`,
  `issuedAt` ← `bundle.updated_at`, data_dates ← `alertDataDates(bundle.data_dates)`).
  Absent → falls back to legacy `getAlerts()` alerts@1. (bundle.nowAlerts
  only populates after U3 lands in data.ts — owned by that unit; page is
  defensive.) Reference_date is cosmetic for the alerts flow (issuedAt comes
  from `bundle.updated_at`) but is no longer hardcoded.
- Sorts cards emergency → warning → watch.
- `held` badge in the valid-window row for hold/held candidates.
- Footer line dedupes: rendered only when guidance doesn't already end with
  "Follow Civil Defense guidance. SMS 40199." — every rendered card still
  ends with it.
- All card/page text ≥12px (text-[10px]/text-[11px] → text-xs).
- Intro copy kept (quiet-hours rule still accurate).
- No 'confirmed' language, no new deps, en-US UI.

## Commands run and results

- `bun install` — 753 packages, clean.
- `bun test src/lib/alerts.test.ts` — **13 pass / 0 fail** (53 expects).
- `bun test` (whole suite) — **58 pass / 0 fail**.
- `bun run build` — **green** (sync-data no-op: data repo not present in
  worktree; TypeScript clean; /alerts builds as Partial Prerender ◐).
  One iteration: TS2345 on `nearestPlace(lon, lat)` destructured centroid —
  fixed by indexing `c.centroid` tuple directly.
- `bun run lint` — 0 errors (1100 pre-existing warnings, none in touched
  files).
- SSR check: `bun run start -p 4177` + `curl localhost:4177/alerts` —
  **HTTP 200**, "SMS 40199" ×5, cards ordered CRITICAL → HIGH → ELEVATED
  (legacy fallback path; doubled grep hits are PPR shell + RSC stream).
  Server killed after check.

Note: `public/data/now/alerts.json` does not exist yet (U3 seam pending) —
the candidates path is proven by the unit tests; the page exercises the
legacy fallback today.
