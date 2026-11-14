"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// SWOT river level (meters, #08306B). bundle.swot is `unknown` — the product
// shape isn't fully settled — so parsing is defensive: a bare array of
// { date, river_m | value_m | level_m }, or an object wrapping it under
// `days`/`points`. Anything unrecognizable renders the placeholder card.
interface SwotPoint {
  date: string;
  m: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const toPoint = (p: unknown): SwotPoint | undefined => {
  if (!isRecord(p) || typeof p.date !== "string") return undefined;
  const m = [p.river_m, p.value_m, p.level_m].find(
    (v) => typeof v === "number" && Number.isFinite(v)
  );
  return m === undefined ? undefined : { date: p.date, m: m as number };
};

export function parseSwot(raw: unknown): SwotPoint[] {
  const arr = Array.isArray(raw)
    ? raw
    : isRecord(raw)
      ? [raw.days, raw.points].find(Array.isArray)
      : undefined;
  return (arr ?? []).reduce<SwotPoint[]>((acc, p) => {
    const pt = toPoint(p);
    if (pt) acc.push(pt);
    return acc;
  }, []);
}

export default function SwotChart({ swot }: { swot: unknown }) {
  const data = parseSwot(swot);
  if (data.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-cc-line-strong p-4 text-center">
        <p className="text-xs font-medium text-cc-ink">No SWOT river data</p>
        <p className="mt-1 text-xs text-cc-faint">
          SWOT river gauge series was not published for this case.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-cc-line p-3">
      <p className="mb-1 text-xs font-medium text-cc-ink">
        SWOT river level (m)
      </p>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#edf0ea" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "#44535a" }}
              tickLine={false}
              axisLine={{ stroke: "#9aa7a0" }}
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#44535a" }}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #cfd6cf",
                fontSize: 12,
              }}
              labelStyle={{ color: "#16242b" }}
              formatter={(v) => [
                typeof v === "number" ? `${v.toFixed(2)} m` : String(v ?? "—"),
                "River level",
              ]}
            />
            <Line
              type="monotone"
              dataKey="m"
              name="River level (m)"
              stroke="#08306B"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
