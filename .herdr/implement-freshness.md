# L13 freshness threshold

Branch: `unit/freshness`, created exactly with `git checkout -b unit/freshness origin/main`; base SHA `36fbf95`.

## Change

`src/components/Header.tsx`: changed FreshnessPill from `mins > 6 * 60` to `mins > 12 * 60`; updated its existing comment to `pipeline runs every 6 h — flag after 12`. No other source changes.

Searched `src/components` and `src/app` using pattern `3 h|3-hour|180`. Only matches were the changed Header comment and a comment in `src/app/page.tsx` about a 3-hourly pipeline. The latter is not rendered text and was intentionally left untouched per scope. No rendered cadence claims required edits. No hindcast specification changes.

## Verification

Commands ran on the final one-line source diff atop `36fbf95` (the source and this report are committed together with the requested L13 message).

- `git status --short`: clean before branch creation.
- `bun install`: exit 0; `Checked 816 installs across 845 packages (no changes)`.
- `bunx eslint src/components/Header.tsx`: exit 0, no output.
- `bun test`: exit 0; `257 pass`, `6 skip`, `0 fail`, `759 expect() calls`, 263 tests across 16 files. Skips are live GEE smoke tests gated on absent credentials.
- `bun run build`: exit 0; `Compiled successfully in 3.7s`, `Finished TypeScript in 2.6s`, `Generating static pages ... (13/13)`. Existing prebuild sync skipped because sibling data directory is absent.
- `git diff --check`: exit 0.
- `git diff`, `git log -3 --oneline`, `git status --short`: reviewed source diff, commit style and scope; only Header was modified before this requested report.

The existing strict greater-than comparison and minute rounding are preserved; the threshold is now 720 minutes instead of 360. No browser proof or dedicated FreshnessPill test is claimed. No new dependencies and no push.
