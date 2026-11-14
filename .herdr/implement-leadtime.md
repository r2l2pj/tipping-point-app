# leadtime-keys — implementation report

## What changed

- `src/lib/contract.ts`
  - New exported types: `AnchorPrecision` ('hour'|'date'|'mixed'), `LeadTimeHist`
    (`{bin_h, from_h, counts[]}`), `DamageAnchor` (`{at, source?, url?}`),
    `LeadTimeAssumptions` (`{imerg?, smap?, geos_fp?, quality?: 'measured'|'placeholder', [k]}`).
  - `MetricsV4`: added 12 optional lead-time keys (`lead_time_iqr_h`,
    `warned_24h_pct`, `never_critical_pct`, `n_points`, `anchor_precision`,
    `event_lead_h`, `official_warning_delta_h`, `lead_time_assumptions`,
    `lead_time_hist`, `critical_area_km2`, `critical_area_with_damage_pct`,
    `damage_anchor`). Flat keys pass through via the existing spread; the legacy
    nested branch does not synthesize them.
  - `PCT_KEYS`: added `warned_24h_pct`, `never_critical_pct`,
    `critical_area_with_damage_pct` (normalize 0-100 → 0-1).
- `src/lib/contract.test.ts`: 3 new tests — new pct keys normalize to 0-1;
  `lead_time_iqr_h`/`lead_time_hist`/`damage_anchor`/`lead_time_assumptions`
  pass through by reference (untouched); legacy view leaves all lead-time keys
  undefined.
- `public/data/metrics.json`: placeholder lead-time mock values for `rs_2024`
  and `wa_2025` per spec, all flagged `lead_time_assumptions.quality:
  'placeholder'`. Existing values unchanged.
- `docs/app-contract.md`: new "lead time (retrospective)" section under
  metrics.json — key/type/meaning table plus honesty note (retrospective only,
  median+IQR+n+never_critical_pct shown together, placeholder flag,
  damage_anchor mirrored in events/*.json).

## Commands run

- `bun test` — 222 pass, 0 fail (625 expect calls, 14 files).
- `bun run lint` — 0 errors, 1100 warnings (pre-existing, mostly
  generated/`.d.ts` files).
- `git branch --show-current` — `unit/leadtime-keys`.
