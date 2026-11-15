"use client";

import { fmtPct } from "@/lib/tpi";
import type { CaseBundle } from "@/lib/types";
import FeatureImportanceChart from "../charts/FeatureImportanceChart";
import SwotChart from "../charts/SwotChart";
import { isMockDerived, pendingIncludes } from "./format";
import LeadTimeCard from "./LeadTimeCard";
import { StatCard } from "./Stat";

// Share of the scene the optical sensor saw (100 - cloud %), as an integer
// percent. metricsView already normalizes cloud_pct to 0-1, so 1 means 100%
// cloud here; only a value > 1 can be a raw 0-100 metrics.json number (e.g.
// 92.9) that skipped normalization — rescale it so it can never render as
// -9189%. Out-of-range -> null.
export function opticalSeenPct(cloudPct: number | null | undefined): number | null {
  if (cloudPct == null || !Number.isFinite(cloudPct)) return null;
  const frac = cloudPct > 1 ? cloudPct / 100 : cloudPct;
  if (frac < 0 || frac > 1) return null;
  return Math.round((1 - frac) * 100);
}

// Ratio scores (IoU/F1/P/R) as 2-decimal text; absent -> em dash.
const score = (v: number | null | undefined) =>
  v != null && Number.isFinite(v) ? v.toFixed(2) : "—";

// "Acertamos?" — did the pipeline get it right: flood scores vs reference,
// landslide model vs the manual slope rule, early-warning lead times, and why
// radar was needed at all. All metric reads go through bundle.metricsView.
export default function ValidationTab({ bundle }: { bundle: CaseBundle }) {
  const m = bundle.metricsView;
  if (!m || pendingIncludes(bundle, "metrics")) {
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

  const opticalPct = opticalSeenPct(m.cloud_pct);
  const hasRaw = [m.iou_raw, m.f1_raw, m.precision_raw, m.recall_raw].some(
    (v) => v != null
  );

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-zinc-300">
        Flood detection vs reference (NISAR vs OPERA, new flood)
      </p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="IoU" value={score(m.iou)} absent={m.iou == null} />
        <StatCard label="F1" value={score(m.f1)} absent={m.f1 == null} />
        <StatCard
          label="Precision"
          value={score(m.precision)}
          absent={m.precision == null}
        />
        <StatCard
          label="Recall"
          value={score(m.recall)}
          absent={m.recall == null}
        />
      </div>
      {m.validation_method && (
        <p className="text-xs leading-snug text-zinc-500">
          {m.validation_method}
        </p>
      )}
      {hasRaw && (
        <div className="rounded-md border border-zinc-800 p-2.5">
          <p className="text-xs text-zinc-400">
            All water incl. permanent (secondary)
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-300">
            IoU {score(m.iou_raw)} · F1 {score(m.f1_raw)} · P{" "}
            {score(m.precision_raw)} · R {score(m.recall_raw)}
          </p>
          {m.opera_fn_diagnosis && (
            <p className="mt-1 text-xs leading-snug text-zinc-500">
              {m.opera_fn_diagnosis}
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Landslide catalog hits"
          value={fmtPct(m.landslide_hit_pct)}
          absent={m.landslide_hit_pct == null}
        />
        <StatCard
          label="Hand validation"
          value={fmtPct(m.hand_validation)}
          absent={m.hand_validation == null}
        />
      </div>
      {!m.validation_method && (
        <p className="text-xs text-zinc-500">
          Scores are computed on clear-sky reference cells only — no cloud
          pixels are counted.
        </p>
      )}

      <p className="text-xs font-medium text-zinc-300">
        Landslide model — learned vs manual slope rule
      </p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="ML model AUC (XGBoost)"
          value={m.rf_auc != null ? m.rf_auc.toFixed(2) : "—"}
          accent="green"
          absent={m.rf_auc == null}
        />
        <StatCard
          label="Manual slope-rule AUC"
          value={m.rule_auc != null ? m.rule_auc.toFixed(2) : "—"}
          absent={m.rule_auc == null}
        />
      </div>

      <LeadTimeCard bundle={bundle} />

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
        <p className="text-xs text-zinc-600">
          Data pending — pipeline output not published.
        </p>
      )}
    </div>
  );
}
