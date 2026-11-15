// L42: "NISAR time series" — HH backscatter (dB) over the flood candidates vs
// control areas on the reference, pre- and post-event passes, and the three
// radar frames. Plain SVG: three points per line, no chart library needed.
import type { NisarSeriesView } from "./model/nisarSeries";

const W = 260, H = 110, PL = 30, PR = 8, PT = 8, PB = 22;
const COLORS = ["#2166ac", "#7b7b7b", "#a6761d", "#1b9e77", "#7570b3"];

export default function NisarSeriesChart({ s }: { s: NisarSeriesView }) {
  const n = s.dates.length;
  const x = (i: number) => PL + (n === 1 ? 0 : (i * (W - PL - PR)) / (n - 1));
  const y = (v: number) => PT + ((s.max - v) * (H - PT - PB)) / (s.max - s.min || 1);
  const ticks = [s.min, (s.min + s.max) / 2, s.max];
  const path = (vals: (number | null)[]) =>
    vals.map((v, i) => (v === null ? "" : `${i === 0 || vals[i - 1] === null ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join("");
  return (
    <div className="mt-2 border-t border-cc-rule pt-1.5 text-xs" data-nisar-series>
      <p className="m-0 font-semibold">NISAR time series — radar brightness ({s.units})</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full max-w-[320px]" role="img"
        aria-label={`HH backscatter in dB on ${s.dates.join(", ")} over ${s.lines.map((l) => l.label).join(", ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="#d9dee0" strokeWidth={0.5} />
            <text x={PL - 3} y={y(t) + 3} textAnchor="end" fontSize={8} fill="#5b6870">{t.toFixed(0)}</text>
          </g>
        ))}
        {s.dates.map((d, i) => (
          <text key={d} x={x(i)} y={H - 8} textAnchor="middle" fontSize={8} fill="#5b6870">{d}</text>
        ))}
        {s.lines.map((l, k) => (
          <g key={l.id}>
            <path d={path(l.hh)} fill="none" stroke={COLORS[k % COLORS.length]} strokeWidth={l.flood ? 2.2 : 1.2} />
            {l.hh.map((v, i) => v === null ? null : (
              <circle key={i} cx={x(i)} cy={y(v)} r={l.flood ? 2.6 : 1.8}
                fill={s.otherGeometry[i] ? "#ffffff" : COLORS[k % COLORS.length]} stroke={COLORS[k % COLORS.length]} strokeWidth={1} />
            ))}
          </g>
        ))}
      </svg>
      <ul className="m-0 mt-0.5 flex list-none flex-wrap gap-x-3 gap-y-0.5 p-0">
        {s.lines.map((l, k) => (
          <li key={l.id} className={l.flood ? "font-semibold" : "text-cc-muted"}>
            <span className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ background: COLORS[k % COLORS.length] }} />
            {l.label}
          </li>
        ))}
      </ul>
      {s.reading && <p className="m-0 mt-1 text-cc-muted">{s.reading}</p>}
      {s.otherGeometry.some(Boolean) && (
        <p className="m-0 mt-0.5 text-cc-faint">Hollow points: passes from another orbit (different viewing angle) — compare their level with care.</p>
      )}
      {s.geometryNote && <p className="m-0 mt-0.5 text-cc-faint">{s.geometryNote}</p>}
      {s.frames.length > 0 && (
        <div className="mt-1.5 grid gap-1" data-nisar-frames style={{ gridTemplateColumns: `repeat(${Math.min(s.frames.length, 4)}, minmax(0, 1fr))` }}>
          {s.frames.map((f) => (
            <figure key={f.url} className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote data PNG, no image optimizer */}
              <img src={f.url} alt={`NISAR radar ${f.label}${f.role ? ` (${f.role})` : ""}`} loading="lazy"
                className="aspect-square w-full rounded border border-cc-line bg-black object-cover" />
              <figcaption className="text-[11px] leading-tight text-cc-muted">{f.label}{f.role ? ` · ${f.role}` : ""}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {s.status && <p className="m-0 mt-1 text-cc-faint">{s.status}</p>}
    </div>
  );
}
