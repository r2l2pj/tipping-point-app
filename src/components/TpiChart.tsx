"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesDaily } from "@/lib/types";

// v3 chart spec: IMERG bars #2166AC, SMAP line #8C510A (right axis 0–1),
// dashed P95 rain threshold #BD0026, TPI risk line red, event marker vertical.
export default function TpiChart({ series, dayIndex }: { series: SeriesDaily; dayIndex: number }) {
  const eventIdx = series.days.findIndex((d) => d.offset === 0);
  const firstForecast = series.days.find((d) => d.kind === "forecast");
  const data = series.days.map((d) => ({
    ...d,
    label: d.offset === 0 ? "EVENT" : d.offset < 0 ? `D${d.offset}` : `D+${d.offset}`,
  }));
  const eventLabel = data[eventIdx]?.label;

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-300">
        Rain, Soil Moisture and TPI (region average)
      </p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: -6, bottom: 0, left: -26 }}>
            <CartesianGrid stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#a1a1aa" }}
              tickLine={false}
              axisLine={{ stroke: "#3f3f46" }}
              minTickGap={14}
            />
            <YAxis
              yAxisId="rain"
              // Round the top up to a tick multiple — a literal dataMax
              // domain edge renders an ugly raw-value tick (e.g. a
              // "144.5334261516383" axis label on a 144 mm peak day).
              domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax / 20) * 20)]}
              tick={{ fontSize: 12, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              label={{ value: "Rain (mm)", angle: -90, position: "insideLeft", fontSize: 12, fill: "#71717a" }}
            />
            <YAxis
              yAxisId="idx"
              orientation="right"
              domain={[0, 1]}
              tick={{ fontSize: 12, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              label={{ value: "SMAP / TPI", angle: 90, position: "insideRight", fontSize: 12, fill: "#71717a" }}
            />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }}
              labelStyle={{ color: "#e4e4e7" }}
              formatter={(v, name) =>
                typeof v !== "number"
                  ? [String(v ?? "—"), String(name)]
                  : name === "Rain (mm)"
                    ? [`${v.toFixed(1)} mm`, name]
                    : [v.toFixed(2), name]
              }
            />
            {firstForecast && (
              <ReferenceArea
                yAxisId="rain"
                x1={firstForecast.offset === 0 ? "EVENT" : `D+${firstForecast.offset}`}
                x2={data[data.length - 1].label}
                fill="#3f3f46"
                fillOpacity={0.25}
              />
            )}
            <Bar yAxisId="rain" dataKey="imerg_mm" name="Rain (mm)" fill="#2166AC" radius={[2, 2, 0, 0]} />
            {/* null is a gap, never a zero — a pipeline "no data" day must
                not draw as a real 0 reading. */}
            <Line yAxisId="idx" type="monotone" dataKey="smap" name="Soil Moisture (SMAP)" stroke="#8C510A" strokeWidth={2} dot={false} connectNulls={false} />
            <Line yAxisId="idx" type="monotone" dataKey="tpi" name="TPI (risk index)" stroke="#BD0026" strokeWidth={2} dot={false} connectNulls={false} />
            <ReferenceLine
              yAxisId="idx"
              y={series.tpi_threshold ?? 0.6}
              stroke="#BD0026"
              strokeDasharray="5 4"
              label={{ value: `TPI Threshold (${(series.tpi_threshold ?? 0.6).toFixed(2)})`, position: "insideTopLeft", fontSize: 12, fill: "#fca5a5" }}
            />
            {series.rain_p95_mm != null && (
              <ReferenceLine yAxisId="rain" y={series.rain_p95_mm} stroke="#BD0026" strokeDasharray="3 3" />
            )}
            {eventLabel && <ReferenceLine yAxisId="rain" x={eventLabel} stroke="#E5E5E5" strokeWidth={1.5} />}
            {data[dayIndex] && data[dayIndex].label !== eventLabel && (
              <ReferenceLine yAxisId="rain" x={data[dayIndex].label} stroke="#22d3ee" strokeWidth={1} strokeDasharray="3 3" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400">
        <Swatch color="#2166AC" label="Rain (IMERG)" />
        <Swatch color="#8C510A" label="Soil Moisture (SMAP)" />
        <Swatch color="#BD0026" label="TPI (risk index)" />
        <Swatch color="#BD0026" dashed label={`TPI Threshold (${(series.tpi_threshold ?? 0.6).toFixed(2)})`} />
      </div>
    </div>
  );
}

function Swatch({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-0.5 w-3"
        style={{ background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)` : color }}
      />
      {label}
    </span>
  );
}
