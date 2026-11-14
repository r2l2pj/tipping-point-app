"use client";

import { fmtPct } from "@/lib/tpi";
import type { CaseBundle } from "@/lib/types";
import FeatureImportanceChart from "../charts/FeatureImportanceChart";
import SwotChart from "../charts/SwotChart";
import { fmtHours, isMockDerived } from "./format";
import { StatCard } from "./Stat";

// "Acertamos?" — did the pipeline get it right: flood scores vs reference,
// landslide model vs the manual slope rule, early-warning lead times, and why
// radar was needed at all. All metric reads go through bundle.metricsView.
export default function ValidationTab({ bundle }: { bundle: CaseBundle }) {
  const m = bundle.metricsView;
  if (!m) {
    return (
      <div className="rounded-md border border-dashed border-zinc-700 p-4 text-center">
        <p className="text-xs font-medium text-zinc-300">
          No validation metrics yet
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Metrics are computed on replay cases against NISAR-confirmed flood
          maps and OPERA products. Switch to a replay case.
        </p>
      </div>
    );
  }

  const opticalPct =
    m.cloud_pct == null ? null : Math.round((1 - m.cloud_pct) * 100);

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-zinc-300">
        Flood detection vs reference (NISAR/OPERA)
      </p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="IoU" value={m.iou != null ? m.iou.toFixed(2) : "—"} />
        <StatCard label="F1" value={m.f1 != null ? m.f1.toFixed(2) : "—"} />
        <StatCard
          label="Landslide catalog hits"
          value={fmtPct(m.landslide_hit_pct)}
        />
        <StatCard label="Hand validation" value={fmtPct(m.hand_validation)} />
      </div>
      <p className="text-xs text-zinc-500">
        Scores are computed on clear-sky reference cells only — no cloud pixels
        are counted.
      </p>

      <p className="text-xs font-medium text-zinc-300">
        Landslide model — learned vs manual slope rule
      </p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Learned (RF) AUC"
          value={m.rf_auc != null ? m.rf_auc.toFixed(2) : "—"}
          accent="green"
        />
        <StatCard
          label="Manual slope-rule AUC"
          value={m.rule_auc != null ? m.rule_auc.toFixed(2) : "—"}
        />
      </div>

      <p className="text-xs font-medium text-zinc-300">Early warning</p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Mean lead time"
          value={fmtHours(m.lead_time_mean_h)}
          accent="green"
        />
        <StatCard
          label="Median lead time"
          value={fmtHours(m.lead_time_median_h)}
          accent="green"
        />
        <StatCard
          label="Zones warned before event"
          value={fmtPct(m.warned_before_pct)}
          accent="green"
        />
      </div>

      <div className="rounded-md border border-zinc-800 p-3">
        <p className="text-xs font-medium text-zinc-300">Why radar</p>
        <p className="mt-1 text-xs leading-snug text-zinc-400">
          {opticalPct != null
            ? `During the event the optical saw only ${opticalPct}% of the scene — the rest was cloud. SAR sees through.`
            : "Cloud cover during the event is not reported for this case — SAR sees through either way."}
        </p>
      </div>

      {m.feature_importance && (
        <FeatureImportanceChart importance={m.feature_importance} />
      )}

      <SwotChart swot={bundle.swot} />

      {isMockDerived(bundle) && (
        <p className="text-xs text-zinc-600">Illustrative demo data.</p>
      )}
    </div>
  );
}
