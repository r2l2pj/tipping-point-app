// SWOT river level, parsed for the chart. Two shapes:
//  - per reach (lead-analysis, wa_2025/series/swot.json): { reaches: [{
//    reach_id, name, series: [{ time, wse_m, wse_u_m, quality 0-3 }] }],
//    quality_legend, event_dates, _null_reasons } — reaches sit at very
//    different elevations (3 m to 428 m), so each is plotted as its change
//    from its first observation;
//  - legacy flat: [{ date, river_m | value_m | level_m }] or { days | points }.

export interface SwotPoint {
  t: number; // epoch ms
  date: string;
  m: number; // plotted value: change from the reach's first observation (per reach) or level (legacy)
  wse?: number;
  u?: number;
  quality?: number;
}

export interface SwotReach {
  id: string;
  name: string;
  points: SwotPoint[];
}

export interface SwotView {
  kind: "reaches" | "legacy";
  reaches: SwotReach[];
  missing: string[]; // reaches without data, with the reason in short words
  qualityNote?: string;
  eventStart?: number;
  eventPeak?: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const ms = (s: unknown): number | undefined => {
  if (typeof s !== "string") return undefined;
  const t = Date.parse(s.length === 10 ? `${s}T12:00:00Z` : s);
  return Number.isFinite(t) ? t : undefined;
};

const QUALITY_WORD: Record<number, string> = { 0: "good", 1: "suspect", 2: "degraded", 3: "bad" };

function legacy(raw: unknown): SwotView | undefined {
  const arr = Array.isArray(raw) ? raw : isRecord(raw) ? [raw.days, raw.points].find(Array.isArray) : undefined;
  const points = (arr ?? []).flatMap((p): SwotPoint[] => {
    if (!isRecord(p) || typeof p.date !== "string") return [];
    const m = [p.river_m, p.value_m, p.level_m].map(num).find((v) => v !== undefined);
    const t = ms(p.date);
    return m === undefined || t === undefined ? [] : [{ t, date: p.date, m }];
  });
  return points.length ? { kind: "legacy", reaches: [{ id: "river", name: "River level", points }], missing: [] } : undefined;
}

export function parseSwot(raw: unknown): SwotView | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.reaches)) return legacy(raw);
  const reasons = isRecord(raw._null_reasons) ? raw._null_reasons : {};
  const reaches: SwotReach[] = [];
  const missing: string[] = [];
  const qualities = new Set<number>();
  for (const r of raw.reaches) {
    if (!isRecord(r)) continue;
    const id = String(r.reach_id ?? "");
    const name = typeof r.name === "string" && r.name ? `${r.name} (${id.slice(-3)})` : `reach ${id}`;
    const rows = (Array.isArray(r.series) ? r.series : [])
      .filter(isRecord)
      .map((p) => ({ t: ms(p.time), wse: num(p.wse_m), u: num(p.wse_u_m), q: num(p.quality) }))
      .filter((p): p is { t: number; wse: number; u: number | undefined; q: number | undefined } =>
        p.t !== undefined && p.wse !== undefined && p.q !== 3) // quality 3 = bad: not plotted
      .sort((a, b) => a.t - b.t);
    if (!rows.length) {
      const why = typeof reasons[id] === "string" && /not found/i.test(reasons[id] as string)
        ? "not in the SWOT river database" : "no observations";
      missing.push(`reach ${id}: ${why}`);
      continue;
    }
    const base = rows[0].wse;
    rows.forEach((p) => p.q !== undefined && qualities.add(p.q));
    reaches.push({
      id,
      name,
      points: rows.map((p) => ({
        t: p.t, date: new Date(p.t).toISOString().slice(0, 10),
        m: Math.round((p.wse - base) * 100) / 100, wse: p.wse, u: p.u, quality: p.q,
      })),
    });
  }
  if (!reaches.length && !missing.length) return undefined;
  const words = [...qualities].sort().map((q) => QUALITY_WORD[q] ?? `quality ${q}`);
  const allFlagged = qualities.size > 0 && ![...qualities].includes(0);
  const ev = isRecord(raw.event_dates) ? raw.event_dates : {};
  return {
    kind: "reaches",
    reaches,
    missing,
    qualityNote: allFlagged
      ? `Every observation is flagged ${words.join(" or ")} by SWOT (no 'good' quality): read the trend, not the centimetres.`
      : words.length ? `SWOT quality flags present: ${words.join(", ")}.` : undefined,
    eventStart: ms(ev.start),
    eventPeak: ms(ev.peak),
  };
}
