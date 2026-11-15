// L42a/L51 plain language (lead-submission, v6): data notes written for the
// team carry pipeline jargon (Otsu, UNGATED, file keys like forecast_proof,
// "zip"). Rewrite the known phrases on screen; the data stays as published.
const RULES: [RegExp, string][] = [
  [/\(\s*UNGATED\s*[—-]\s*no per-scene Otsu;\s*not a flood product\s*\)/gi, "(not a flood map — no automatic threshold)"],
  [/\bUNGATED\b[^;,)]*/gi, "not a flood map (no automatic threshold)"],
  [/teammate zip change polygons\s*\(cross-check only\)/gi, "teammate change map (cross-check)"],
  [/teammate zip change polygons/gi, "teammate change map"],
  [/teammate zip\b/gi, "teammate pair"],
  [/\bits own P99\b/g, "its extreme level"],
  [/\(see forecast_proof\)/g, "(see the upstream-rain test)"],
  [/\s*\(see [a-z0-9]+(?:_[a-z0-9]+)+\)/g, ""],
];
export const plainText = (s: string): string => RULES.reduce((t, [re, to]) => t.replace(re, to), s);
