"use client";

import type { CaseBundle } from "@/lib/types";
import { fmtPct } from "@/lib/tpi";
import LeadTimeHistogram from "../charts/LeadTimeHistogram";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const numberText = (v: unknown) => finite(v) ? String(Math.round(v)) : "not reported";

export default function LeadTimeCard({ bundle }: { bundle: CaseBundle }) {
  const m = bundle.metricsView as Record<string, unknown> | undefined;
  if (!m || !finite(m.lead_time_median_h)) return null;
  const iqr = Array.isArray(m.lead_time_iqr_h) ? m.lead_time_iqr_h : [];
  const assumptions = m.lead_time_assumptions;
  const note = typeof assumptions === "string" ? assumptions
    : assumptions && typeof assumptions === "object" ? JSON.stringify(assumptions).slice(0, 400)
    : "IMERG Early ~4 h and SMAP L4 release latency applied; perfect-forecast layers excluded.";
  const placeholder = !!assumptions && typeof assumptions === "object"
    && (assumptions as Record<string, unknown>).quality === "placeholder";
  const precision = m.anchor_precision === "hour" ? "hour-precision anchors"
    : m.anchor_precision === "date" ? "date-precision anchors"
    : m.anchor_precision === "mixed" ? "mixed-precision anchors" : null;
  return (
    <section className="space-y-2 rounded-md border border-zinc-800 p-3 text-xs text-zinc-300">
      <h3 className="font-semibold">How early? (in replay)</h3>
      {placeholder && <p className="text-amber-300">Illustrative numbers</p>}
      <p className="font-medium">{`Median ${numberText(m.lead_time_median_h)} h before mapped landslides`}</p>
      <p>{`IQR ${numberText(iqr[0])}–${numberText(iqr[1])} h · n = ${numberText(m.n_points)}`}{precision ? ` · ${precision}` : ""}</p>
      <dl className="grid grid-cols-2 gap-2">
        {([
          ["warned_before_pct", "Flagged before damage"],
          ["warned_24h_pct", "Warned >= 24 h early"],
          ["never_critical_pct", "Never crossed Critical"],
        ] as const).map(([key, label]) => finite(m[key]) && (
          <div key={key}><dt className="text-zinc-400">{label}</dt><dd>{fmtPct(m[key] as number)}</dd></div>
        ))}
      </dl>
      {finite(m.official_warning_delta_h) && <p>{`vs first official warning: ${m.official_warning_delta_h >= 0 ? "+" : ""}${numberText(m.official_warning_delta_h)} h (+ = we flagged earlier)`}</p>}
      {finite(m.event_lead_h) && <p>{`Event-level anchor lead: ${numberText(m.event_lead_h)} h`}</p>}
      {finite(m.critical_area_with_damage_pct) && <p>{`Critical area that had damage: ${fmtPct(m.critical_area_with_damage_pct)}`}{finite(m.critical_area_km2) ? ` · Critical area: ${numberText(m.critical_area_km2)} km²` : ""}</p>}
      <LeadTimeHistogram histogram={m.lead_time_hist} />
      <p className="text-zinc-400">In replay: {note}</p>
    </section>
  );
}
