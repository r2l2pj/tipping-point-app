"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { parseSwot } from "./swot";

export { parseSwot } from "./swot";

// One color per reach (sequential blues, distinguishable on white).
const REACH_COLORS = ["#08306B", "#2171B5", "#6BAED6", "#9E9AC8", "#54278F"];
const fmtDay = (t: number) =>
  new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// SWOT river level near the event. Per-reach data (WA) is plotted as the
// change from each reach's first observation, so a 3 m and a 428 m reach
// share one axis; the quality flags are stated, never hidden.
export default function SwotChart({ swot }: { swot: unknown }) {
  const view = parseSwot(swot);
  if (!view || view.reaches.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-cc-line-strong p-4 text-center">
        <p className="text-xs font-medium text-cc-ink">No SWOT river data</p>
        <p className="mt-1 text-xs text-cc-faint">
          {view?.missing.length ? view.missing.join("; ") : "SWOT river gauge series was not published for this case."}
        </p>
      </div>
    );
  }
  const perReach = view.kind === "reaches";
  const title = perReach ? "SWOT river level — change since first pass (m)" : "SWOT river level (m)";
  return (
    <div className="rounded-md border border-cc-line p-3" data-swot={view.kind}>
      <p className="mb-1 text-xs font-medium text-cc-ink">{title}</p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#edf0ea" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={fmtDay}
              tick={{ fontSize: 12, fill: "#44535a" }}
              tickLine={false}
              axisLine={{ stroke: "#9aa7a0" }}
              minTickGap={28}
              allowDuplicatedCategory={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#44535a" }}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{ background: "#ffffff", border: "1px solid #cfd6cf", fontSize: 12 }}
              labelStyle={{ color: "#16242b" }}
              labelFormatter={(t) => (typeof t === "number" ? fmtDay(t) : String(t))}
              formatter={(v, name) => [
                typeof v === "number" ? `${v >= 0 && perReach ? "+" : ""}${v.toFixed(2)} m` : String(v ?? "—"),
                String(name),
              ]}
            />
            {view.eventStart && <ReferenceLine x={view.eventStart} stroke="#9aa7a0" strokeDasharray="4 3" />}
            {view.eventPeak && <ReferenceLine x={view.eventPeak} stroke="#16242b" strokeWidth={1.5} />}
            {view.reaches.map((r, i) => (
              <Line
                key={r.id}
                data={r.points}
                dataKey="m"
                name={r.name}
                type="linear"
                stroke={REACH_COLORS[i % REACH_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 2.5 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
        {view.reaches.map((r, i) => (
          <span key={r.id} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-0.5 w-4" style={{ background: REACH_COLORS[i % REACH_COLORS.length] }} />
            {r.name}
          </span>
        ))}
        {view.eventPeak && <span className="text-cc-muted">solid line: event peak</span>}
      </div>
      {view.qualityNote && <p className="mt-1 text-xs text-cc-warn">{view.qualityNote}</p>}
      {view.missing.length > 0 && <p className="mt-0.5 text-xs text-cc-faint">No data: {view.missing.join("; ")}.</p>}
    </div>
  );
}
