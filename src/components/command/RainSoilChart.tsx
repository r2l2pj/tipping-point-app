"use client";

import { memo } from "react";
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { gfsRain3Label } from "./model/steps";
import { thresholdFor } from "./model/status";
import type { Step } from "./model/steps";
import { NOT_PUBLISHED, type CcBundle } from "./model/types";

// A day without a value shows "no data", never 0.
const cell = (v: unknown, digits: number): string =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "no data";

const RAIN = "#2166AC";
const RAIN_FC = "#9ECAE1";
const RAIN_GFS = "#7570B3";
const SOIL = "#8C510A";
const TPI = "#BD0026";

// Chart specification of the specialist: IMERG bars, SMAP line (right axis
// 0 to 1), TPI line, dashed TPI threshold, dashed P95 rain when published,
// event marker. Forecast days: lighter bars, soil line dashed in the soil
// color, so the red dashed line keeps one meaning (the threshold).
function RainSoilChart({
  bundle,
  steps,
  dayIndex,
  asTable,
  forecastLabel,
  onSeek,
  onToggleTable,
}: {
  bundle: CcBundle;
  steps: Step[];
  dayIndex: number;
  asTable: boolean;
  forecastLabel: string;
  onSeek: (i: number) => void;
  onToggleTable: () => void;
}) {
  const series = bundle.series;
  const days = steps.filter((s) => s.day);
  const title = "Rain, Soil Moisture and TPI (region average)";
  if (!series || days.length === 0) {
    return (
      <section aria-label={title}>
        <h2 className="m-0 text-[15px] font-semibold">{title}</h2>
        <p className="py-2 text-[13px] italic text-cc-faint">Daily series: {NOT_PUBLISHED}</p>
      </section>
    );
  }
  const threshold = thresholdFor(bundle);
  const firstFc = days.findIndex((s) => s.forecast);
  const data = days.map((s, i) => ({
    label: s.top,
    imerg_mm: s.day!.imerg_mm,
    // Forecast days only: the issued NOAA GFS 3-day total beside the
    // observed 3-day bar (the 1-day gfs_mm is not plotted: ~3x too dry
    // next to a 3-day total).
    gfs3: s.forecast && typeof s.day!.gfs_rain3_mm === "number" ? s.day!.gfs_rain3_mm : null,
    tpi: s.day!.tpi,
    // The observed soil line ends where the forecast line starts.
    smapObs: !s.forecast || i === firstFc ? s.day!.smap : null,
    smapFc: s.forecast || i === firstFc - 1 ? s.day!.smap : null,
    forecast: s.forecast,
  }));
  const event = days.find((s) => s.offset === 0);
  const current = days.find((s) => s.index === dayIndex);
  const hasFc = firstFc >= 0;
  const gfsLabel = gfsRain3Label(days.filter((s) => s.forecast).map((s) => s.day!));
  const hasGfs = gfsLabel !== undefined && data.some((d) => d.gfs3 !== null);

  return (
    <section aria-label={title}>
      <div className="flex items-center gap-2">
        <h2 className="m-0 grow text-[15px] font-semibold">{title}</h2>
        <button type="button" onClick={onToggleTable} aria-pressed={asTable}
          className="rounded-md border border-cc-line-strong bg-cc-surface px-2.5 py-0.5 text-xs">
          {asTable ? "Chart" : "Table"}
        </button>
      </div>
      {asTable ? (
        <div className="mt-1.5 max-h-[260px] overflow-y-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-right text-cc-muted">
                <th scope="col" className="px-1 py-px text-left font-semibold">Date</th>
                <th scope="col" className="px-1 py-px font-semibold">Rain 3-day (mm)</th>
                {hasGfs && <th scope="col" className="px-1 py-px font-semibold">GFS forecast 3-day (mm)</th>}
                <th scope="col" className="px-1 py-px font-semibold">Soil moisture</th>
                <th scope="col" className="px-1 py-px font-semibold">TPI</th>
                <th scope="col" className="px-1 py-px text-left font-semibold">Kind</th>
              </tr>
            </thead>
            <tbody>
              {days.map((s) => (
                <tr key={s.date} className={`border-t border-cc-rule text-right ${s.index === dayIndex ? "bg-cc-accent-soft" : ""}`}>
                  <th scope="row" className="px-1 py-px text-left font-medium">
                    <button type="button" onClick={() => onSeek(s.index)} className="underline decoration-dotted underline-offset-2"
                      aria-label={`Go to ${s.top}`}>
                      {s.top}
                    </button>
                    {s.sub === "EVENT" ? " (event)" : ""}
                  </th>
                  <td className="px-1 py-px">{cell(s.day!.imerg_mm, 1)}</td>
                  {hasGfs && <td className="px-1 py-px">{s.forecast ? cell(s.day!.gfs_rain3_mm, 1) : ""}</td>}
                  <td className="px-1 py-px">{cell(s.day!.smap, 2)}</td>
                  <td className="px-1 py-px">{cell(s.day!.tpi, 2)}</td>
                  <td className="px-1 py-px text-left">{s.kind === "observed" ? "observed" : `${s.kind} (${forecastLabel})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="mt-1 h-44" role="img"
            aria-label={`${title}. ${days.length} days from ${days[0].top} to ${days[days.length - 1].top}. Use the Table button for the values.`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: -6, bottom: 0, left: -22 }}
                onClick={(e) => {
                  // Recharts reports the active column by label or by index;
                  // a null index must not be read as the first day.
                  const hit = (e ?? {}) as { activeLabel?: unknown; activeTooltipIndex?: unknown; activeIndex?: unknown };
                  const raw = hit.activeTooltipIndex ?? hit.activeIndex;
                  const byLabel = days.findIndex((d) => d.top === hit.activeLabel);
                  const i = byLabel >= 0 ? byLabel
                    : raw === null || raw === undefined || raw === "" ? -1 : Number(raw);
                  if (Number.isInteger(i) && days[i]) onSeek(days[i].index);
                }}>
                <CartesianGrid stroke="#edf0ea" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#44535a" }} tickLine={false} axisLine={{ stroke: "#9aa7a0" }} minTickGap={14} />
                <YAxis yAxisId="rain"
                  // Round the top up to a tick multiple, so the axis never
                  // shows a raw data maximum as a tick.
                  domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax / 20) * 20)]}
                  tick={{ fontSize: 12, fill: "#44535a" }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="idx" orientation="right" domain={[0, 1]} tick={{ fontSize: 12, fill: "#44535a" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#ffffff", border: "1px solid #cfd6cf", fontSize: 12, color: "#16242b" }}
                  formatter={(v, name) =>
                    typeof v !== "number" ? [String(v ?? "—"), String(name)]
                    : String(name).startsWith("Rain") || String(name).startsWith("Forecast rain")
                      ? [`${v.toFixed(1)} mm`, name] : [v.toFixed(2), name]}
                />
                <Bar yAxisId="rain" isAnimationActive={false} dataKey="imerg_mm" name="Rain 3-day (mm)" radius={[3, 3, 0, 0]} cursor="pointer"
                  onClick={(_, i) => {
                    if (days[i]) onSeek(days[i].index);
                  }}>
                  {data.map((d) => <Cell key={d.label} fill={d.forecast ? RAIN_FC : RAIN} />)}
                </Bar>
                {hasGfs && (
                  <Bar yAxisId="rain" isAnimationActive={false} dataKey="gfs3" name="Forecast rain 3-day (NOAA GFS)"
                    fill={RAIN_GFS} radius={[3, 3, 0, 0]} />
                )}
                <Line yAxisId="idx" type="monotone" dataKey="smapObs" isAnimationActive={false} name="Soil moisture (SMAP)" stroke={SOIL} strokeWidth={2} dot={false} connectNulls={false} />
                <Line yAxisId="idx" type="monotone" dataKey="smapFc" isAnimationActive={false} name="Soil moisture (forecast days)" stroke={SOIL} strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls={false} legendType="none" />
                {/* null is a gap, never a zero. */}
                <Line yAxisId="idx" type="monotone" dataKey="tpi" isAnimationActive={false} name="TPI (risk index)" stroke={TPI} strokeWidth={2} dot={false} connectNulls={false} />
                <ReferenceLine yAxisId="idx" y={threshold} stroke={TPI} strokeDasharray="5 4" />
                {typeof series.rain_p95_mm === "number" && (
                  <ReferenceLine yAxisId="rain" y={series.rain_p95_mm} stroke={RAIN} strokeDasharray="3 3" />
                )}
                {event && <ReferenceLine yAxisId="rain" x={event.top} stroke="#16242b" strokeWidth={1.5} />}
                {current && current !== event && (
                  <ReferenceLine yAxisId="rain" x={current.top} stroke="#17473f" strokeWidth={1.5} strokeDasharray="3 3" />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1 text-xs">
            {/* lead-analysis date convention: a replay observed band X sums
                rain on X-3..X-1 (X excluded); Now frames sum X-2..X. */}
            <Swatch color={RAIN} label={bundle.mode === "replay"
              ? "Rain 3-day (IMERG) - observed, the 3 days before each date"
              : "Rain 3-day (IMERG) - observed"} block />
            {hasFc && <Swatch color={RAIN_FC} label={`Rain 3-day - forecast days (${forecastLabel})`} block />}
            {hasGfs && <Swatch color={RAIN_GFS} label={gfsLabel!} block />}
            <Swatch color={SOIL} label="Soil moisture (SMAP)" />
            {hasFc && <Swatch color={SOIL} dashed label="Soil moisture - forecast days" />}
            <Swatch color={TPI} label="TPI (risk index)" />
            <Swatch color={TPI} dashed label={`TPI threshold (${threshold.toFixed(2)})`} />
            {typeof series.rain_p95_mm === "number" && <Swatch color={RAIN} dashed label="Rain P95" />}
          </div>
        </>
      )}
    </section>
  );
}

// Memoized: the chart redraws only when its own inputs change.
export default memo(RainSoilChart);

function Swatch({ color, label, dashed, block }: { color: string; label: string; dashed?: boolean; block?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={block ? "inline-block h-2.5 w-4 rounded-sm" : "inline-block h-0.5 w-5"}
        style={{ background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : color }} />
      {label}
    </span>
  );
}
