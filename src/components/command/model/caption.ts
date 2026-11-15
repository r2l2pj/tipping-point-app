// Lucas: a one-line map chip instead of the full caption sentence.
// "Landslide TPI · Today · observed to Nov 14 + NOAA GFS forecast for Nov 15
// (partly forecast) · NISAR flood outlines (pass Nov 6, 2026)" →
// "Landslide TPI · Today · partly forecast".
export function shortCaption(text: string, forecast: boolean): string {
  const parts = text.split(" · ").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return text;
  const head = parts[0].replace(/\s*\([^)]*\)/g, "").trim() || parts[0];
  const w = parts[1]?.replace(/\s*\([^)]*\)/g, "").trim();
  const when = w && w.length <= 24 && !/\+/.test(w) ? w : undefined;
  const partly = /partly forecast/i.test(text);
  const tag = partly ? "partly forecast" : forecast ? "forecast" : undefined;
  return [head, when, tag].filter(Boolean).join(" · ");
}
