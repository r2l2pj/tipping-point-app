"use client";

import FeatureImportanceChart from "./charts/FeatureImportanceChart";
import LeadTimeHistogram from "./charts/LeadTimeHistogram";
import SwotChart from "./charts/SwotChart";
import type { LayerId, LayerRow } from "./model/layerRegistry";
import type { CompareOption } from "./model/radar";
import type { Evidence } from "./model/replayCheck";
import { StatGrid } from "./ui";

const h3 = "m-0 text-[13px] font-semibold";

// Validation and impact content of the old tabs (design G4), plus the
// triggers of the replay-evidence overlays.
export default function EvidenceDetails({
  evidence: e,
  swot,
  evidenceRows,
  nightLights,
  onToggleLayer,
  onCompareNightLights,
}: {
  evidence: Evidence;
  swot: unknown;
  evidenceRows: LayerRow[]; // catalog and OPERA rows of the layer registry
  nightLights: CompareOption;
  onToggleLayer: (id: LayerId) => void;
  onCompareNightLights: () => void;
}) {
  const btn = "rounded-lg border border-cc-line-strong bg-cc-surface px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-cc-line pt-2">
      <div>
        <h3 className={h3}>Flood detection vs reference (NISAR vs OPERA, new flood)</h3>
        <div className="mt-1"><StatGrid stats={e.floodStats} /></div>
        <p className="mt-1 text-xs text-cc-faint">{e.floodNote}</p>
        {e.floodSecondary && (
          <div className="mt-1 rounded-lg border border-cc-line p-2.5">
            <p className="text-xs text-cc-muted">All water incl. permanent (secondary)</p>
            <p className="mt-1 text-xs tabular-nums">{e.floodSecondary.line}</p>
            {e.floodSecondary.diagnosis && (
              <p className="mt-1 text-xs leading-snug text-cc-faint">{e.floodSecondary.diagnosis}</p>
            )}
          </div>
        )}
      </div>

      <div>
        <h3 className={h3}>{e.modelTitle}</h3>
        <div className="mt-1"><StatGrid stats={e.modelStats} /></div>
      </div>

      {e.leadTime?.missing && (
        <div className="rounded-lg border border-dashed border-cc-line-strong p-2.5 text-xs">
          <h3 className={h3}>How early? (in replay)</h3>
          <p className="mt-1 italic text-cc-faint">{e.leadTime.missing}</p>
        </div>
      )}
      {e.leadTime && !e.leadTime.missing && (
        <div className="rounded-lg border border-cc-line p-2.5 text-xs">
          <h3 className={h3}>How early? (in replay)</h3>
          {e.leadTime.placeholder && <p className="font-semibold text-cc-warn">Illustrative numbers</p>}
          <p className="mt-1 font-semibold">{e.leadTime.median}</p>
          {e.leadTime.iqr && <p>{e.leadTime.iqr}</p>}
          {e.leadTime.shares.length > 0 && (
            <dl className="mt-1 grid grid-cols-2 gap-2">
              {e.leadTime.shares.map((s) => (
                <div key={s.label}><dt className="text-cc-muted">{s.label}</dt><dd>{s.value}</dd></div>
              ))}
            </dl>
          )}
          {e.leadTime.lines.map((line) => <p key={line} className="mt-1">{line}</p>)}
          <LeadTimeHistogram histogram={e.leadTime.histogram} />
          <p className="mt-1 text-cc-muted">{e.leadTime.note}</p>
        </div>
      )}

      <div>
        <h3 className={h3}>Why radar</h3>
        <p className="mt-0.5 text-xs text-cc-muted">{e.whyRadar}</p>
      </div>

      {e.featureImportance && <FeatureImportanceChart importance={e.featureImportance} />}
      <SwotChart swot={swot} />

      <div>
        <h3 className={h3}>Impact</h3>
        <div className="mt-1"><StatGrid stats={e.impactStats} /></div>
        <p className="mt-1 text-xs font-semibold">Exposure basis</p>
        <p className="text-xs text-cc-muted">{e.exposureBasis}</p>
      </div>

      <div>
        <h3 className={h3}>Evidence on the map</h3>
        <div className="mt-1 flex flex-col gap-1.5">
          {evidenceRows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
              <button type="button" className={btn} aria-pressed={r.on} disabled={!r.available} onClick={() => onToggleLayer(r.id)}>
                {r.on ? `Hide ${r.label}` : `Show ${r.label}`}
              </button>
              {!r.available && <span className="italic text-cc-faint">{r.sub}</span>}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button type="button" className={btn} disabled={!nightLights.pair} onClick={onCompareNightLights}>
              Night lights before / after
            </button>
            {!nightLights.pair && <span className="italic text-cc-faint">{nightLights.reason}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
