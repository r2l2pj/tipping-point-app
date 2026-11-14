"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function normalizeLeadTimeHist(value: unknown): { h_from: number; n: number }[] {
  if (Array.isArray(value)) {
    return value.flatMap((row) => row && finite(row.h_from) && finite(row.n) && row.n >= 0
      ? [{ h_from: row.h_from, n: row.n }] : []);
  }
  if (!value || typeof value !== "object") return [];
  const { bin_h, from_h, counts } = value as Record<string, unknown>;
  if (!Array.isArray(counts)) return [];
  const width = finite(bin_h) && bin_h > 0 ? bin_h : 6;
  const start = finite(from_h) ? from_h : 0;
  return counts.flatMap((n, i) => finite(n) && n >= 0 ? [{ h_from: start + i * width, n }] : []);
}

export default function LeadTimeHistogram({ histogram }: { histogram: unknown }) {
  const data = normalizeLeadTimeHist(histogram);
  if (!data.length) return null;
  return (
    <figure aria-label="Lead time histogram" className="text-xs">
      <figcaption className="mb-2 text-zinc-400">Mapped landslides by lead time (in replay)</figcaption>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 20, right: 12, bottom: 24, left: 0 }}>
          <CartesianGrid stroke="#27272a" vertical={false} />
          <XAxis dataKey="h_from" tick={{ fontSize: 12 }} label={{ value: "hours before damage", position: "bottom", fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
          <Tooltip labelFormatter={(value) => `${value} hours before damage`} />
          <Bar dataKey="n" name="Mapped landslides" fill="#22d3ee">
            <LabelList dataKey="n" position="top" fontSize={12} fill="#d4d4d8" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
