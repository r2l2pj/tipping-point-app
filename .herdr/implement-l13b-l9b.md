# L13b + L9b implementation — 6b011cc (unit/l13b-l9b)

## Changes

1. `README.md` (Deploy section): "refreshes data every 6 h; stale-data warning threshold is 12 h" → "every 3 h; threshold is 6 h".

2. `docs/PLAN.md` decisions table only:
   - L13 row: Adotado cell replaced with L13b content (`now.yml` a cada 3 h `0 */3 * * *` + dispatch; nisar/validation diários; reference semanal + dispatch; aviso de dado velho após 6 h / 2 runs perdidos); Por quê cell → "L13b, substitui L13".
   - New row added after it: Cobertura e pitch | cobertura global | começa pelo Sul do Brasil (RS/SC/PR), RS 2024 história principal, WA 2025 só prova de radar, global só no lançamento (uma edição de config, L9) | L9b, Lucas 2026-11-14.
   - Body untouched (diff shows exactly 1 row edit + 1 row add).

3. `submission/summary.md`: one clause — "Built for municipal Civil Defense" → "Built for municipal Civil Defense in Southern Brazil (RS/SC/PR)". Theme sentence byte-identical. RS already the main story; WA already framed as radar proof ("demonstrated on a second case").

4. `submission/slides-outline.md`: added one bullet to Slide 7 roadmap — "Global coverage at release — one config edit".

Other submission files checked, no fixes needed:
- `demo-script.md`: RS cold open is main story; WA used only as the NISAR radar beat — already compliant; no global-coverage claim.
- `nasa-data.md`, `ai-declaration.md`: only dataset names (GPW "World", "Global Landslide Catalog") — not coverage claims.

## Self-checks

- `grep -n "every 6\|6 h" README.md` → only "threshold is 6 h" remains (the correct new value); "every 6 h" gone.
- `grep -n "every 3\|3 h" README.md` → line 42 hit.
- `git diff docs/PLAN.md` → only the one row edit + one row add; no other `-` deletions.
- DRAFT banners intact (summary.md:1, slides-outline.md:1).

## Commit

`6b011cc` — "L13b/L9b: 3 h cadence + Southern Brazil pitch focus" on `unit/l13b-l9b`.

## Follow-up fix (bd3f592)

Removed `MODIS · ` from slides-outline.md slide 7 credit line (A3: not an index input, unused). Remaining MODIS mentions are only in docs/PLAN.md body (byte-verbatim, out of scope).
