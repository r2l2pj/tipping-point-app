"use client";

// RF feature importance -> horizontal bars, ColorBrewer YlOrRd ramp (the
// project palette), sorted descending. Plain divs so the chart also renders
// under SSR/test markup.
const YLORRD = [
  "#FFFFCC",
  "#FFEDA0",
  "#FED976",
  "#FEB24C",
  "#FD8D3C",
  "#FC4E2A",
  "#E31A1C",
  "#BD0026",
  "#800026",
];

const barColor = (t: number) =>
  YLORRD[Math.min(YLORRD.length - 1, Math.max(0, Math.round(t * (YLORRD.length - 1))))];

export default function FeatureImportanceChart({
  importance,
}: {
  importance: Record<string, number>;
}) {
  const rows = Object.entries(importance)
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return null;
  const max = rows[0][1] || 1;

  return (
    <div className="rounded-md border border-zinc-800 p-3">
      <p className="mb-2 text-xs font-medium text-zinc-300">
        Feature importance (learned model)
      </p>
      <ul className="space-y-1.5">
        {rows.map(([name, v]) => {
          const t = v / max;
          return (
            <li key={name}>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="truncate">{name}</span>
                <span>{v.toFixed(2)}</span>
              </div>
              <div className="mt-0.5 h-2 overflow-hidden rounded bg-zinc-800">
                <div
                  className="h-full rounded"
                  style={{ width: `${Math.max(2, t * 100)}%`, background: barColor(t) }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
