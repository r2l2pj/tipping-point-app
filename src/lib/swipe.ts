// Pure helpers for the SwipeCompare component. No maplibre import so they can
// run under `bun test` without a DOM or WebGL.

export const SWIPE_MIN_PCT = 5;
export const SWIPE_MAX_PCT = 95;
export const SWIPE_KEY_STEP = 2;

function clampPct(pct: number): number {
  return Math.min(SWIPE_MAX_PCT, Math.max(SWIPE_MIN_PCT, pct));
}

// Clip path for the AFTER (top) layer: `inset(0 0 0 X%)` hides the left X%,
// so the before map shows on the left of the divider and after on the right.
export function clipPathFor(pct: number): string {
  return `inset(0 0 0 ${pct}%)`;
}

// Horizontal position of the divider (%) from a pointer clientX against the
// container's rect, clamped so the handle can never leave the map.
export function pctFromClientX(
  clientX: number,
  rectLeft: number,
  rectWidth: number
): number {
  if (rectWidth <= 0) return SWIPE_MIN_PCT;
  return clampPct(((clientX - rectLeft) / rectWidth) * 100);
}

// Camera fields mirrored between the two maps on every 'move' event. Matches
// maplibre's JumpToOptions; omitted fields keep their current value.
export function cameraPatch(m: {
  center: [number, number];
  zoom: number;
  bearing?: number;
  pitch?: number;
}): { center: [number, number]; zoom: number; bearing?: number; pitch?: number } {
  return {
    center: m.center,
    zoom: m.zoom,
    bearing: m.bearing,
    pitch: m.pitch,
  };
}

// Keyboard nudge: deltaDir is +1 (right) or -1 (left), one step is 2%.
export function dragStep(pct: number, deltaDir: number): number {
  return clampPct(pct + Math.sign(deltaDir) * SWIPE_KEY_STEP);
}
