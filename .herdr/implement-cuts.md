# Cuts implementation

Base SHA: 0f9feebe8d968a6e02aa9d2b41b7410648c6e0c7 (unit/cuts).

Changed only src/components/Dashboard.tsx and src/components/MapLayers.tsx in production code. Footer classes retain keys, colors and formatting but min/max now derive from [0, ...cutsFor(bundle), 1]. Popup classification uses tpiClass(pv.tpi, b), including both initial estimates and resolved pixels.

Verification on the working tree committed immediately after this report:
- `bun install`: exit 0, 762 packages installed; no lockfile changes.
- `bunx eslint src/components/Dashboard.tsx src/components/MapLayers.tsx`: exit 0, no diagnostics.
- `bun test`: exit 0; 333 pass, 6 skip, 0 fail, 1043 assertions. Live GEE smoke tests skipped.
- `bun run build`: exit 0; compiled successfully, TypeScript passed, 14/14 static pages generated. Prebuild data sync skipped because sibling tipping-point-data/data was absent.
- `git diff --check`: exit 0.

Existing regression coverage checks custom cuts and contract precedence; no new test files were added because the assigned write scope was the two components. No browser verification performed.
