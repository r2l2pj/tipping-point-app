"use client";

import FeatureImportanceChart from "./charts/FeatureImportanceChart";
import GroupImportanceChart from "./charts/GroupImportanceChart";
import MlCard from "./MlCard";
import type { ImportanceView, MlView } from "./model/ml";
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
  ml,
  mlImportance,
  evidenceRows,
  nightLights,
  onToggleLayer,
  onCompareNightLights,
  hideMissing = false,
}: {
  evidence: Evidence;
  swot: unknown;
  ml?: MlView;
  mlImportance?: ImportanceView;
  evidenceRows: LayerRow[]; // catalog and OPERA rows of the layer registry
  nightLights: CompareOption;
  onToggleLayer: (id: LayerId) => void;
  onCompareNightLights: () => void;
  hideMissing?: boolean; // featured replay: drop blocks with no data (model/sparse)
}) {
  const allMissing = (stats: { missing: boolean }[]) => stats.length === 0 || stats.every((s) => s.missing);
  const showFlood = !hideMissing || !allMissing(e.floodStats) || !!e.scarHit || !!e.floodSecondary;
  const showImpact = !hideMissing || !allMissing(e.impactStats);
  const rowsShown = hideMissing ? evidenceRows.filter((r) => r.available) : evidenceRows;
  const showNight = !hideMissing || !!nightLights.pair;
  const btn = "rounded-lg border border-cc-line-strong bg-cc-surface px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-cc-line pt-2">
      {showFlood && <div>
        <h3 className={h3}>Flood detection vs reference (NISAR vs OPERA, new flood)</h3>
        <div className="mt-1"><StatGrid stats={hideMissing ? e.floodStats.filter((s) => !s.missing) : e.floodStats} /></div>
        <p className="mt-1 text-xs text-cc-faint">{e.floodNote}</p>
        {e.scarHit && <p className="mt-1 text-xs text-cc-muted" data-scar-hit>{e.scarHit}</p>}
        {e.floodSecondary && (
          <div className="mt-1 rounded-lg border border-cc-line p-2.5">
            <p className="text-xs text-cc-muted">All water incl. permanent (secondary)</p>
            <p className="mt-1 text-xs tabular-nums">{e.floodSecondary.line}</p>
            {e.floodSecondary.diagnosis && (
              <p className="mt-1 text-xs leading-snug text-cc-faint">{e.floodSecondary.diagnosis}</p>
            )}
          </div>
        )}
      </div>}

      {e.hand && (
        <div data-hand-check>
          <h3 className={h3}>Terrain check: HAND proxy vs MERIT Hydro (reference only)</h3>
          <p className="mt-1 text-xs font-semibold tabular-nums">{e.hand.line}</p>
          {e.hand.note && <p className="mt-0.5 text-xs text-cc-muted">{e.hand.note}</p>}
          {e.hand.definition && <p className="mt-0.5 text-xs text-cc-faint">{e.hand.definition}</p>}
        </div>
      )}

      {/* Model scores only with their n (TEST split, lead-ml ml_card.json). */}
      {ml ? (
        <MlCard ml={ml} />
      ) : !hideMissing && (
        <div>
          <h3 className={h3}>Did we get it right? (TEST data)</h3>
          <p className="mt-0.5 text-xs italic text-cc-faint">Model scores pending: the TEST evaluation with its sample sizes is not published yet.</p>
        </div>
      )}

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

      {mlImportance ? <GroupImportanceChart importance={mlImportance} />
        : e.featureImportance && <FeatureImportanceChart importance={e.featureImportance} />}

      {e.rainCheck && (
        <div>
          <h3 className={h3}>Rain check</h3>
          <p className="mt-0.5 text-xs text-cc-muted">{e.rainCheck}</p>
        </div>
      )}
      {(!hideMissing || swot != null) && <SwotChart swot={swot} />}

      {showImpact && <div>
        <h3 className={h3}>Impact</h3>
        <div className="mt-1"><StatGrid stats={hideMissing ? e.impactStats.filter((s) => !s.missing) : e.impactStats} /></div>
        <p className="mt-1 text-xs font-semibold">Exposure basis</p>
        <p className="text-xs text-cc-muted">{e.exposureBasis}</p>
      </div>}

      {(rowsShown.length > 0 || showNight) && <div>
        <h3 className={h3}>Evidence on the map</h3>
        <div className="mt-1 flex flex-col gap-1.5">
          {rowsShown.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
              <button type="button" className={btn} aria-pressed={r.on} disabled={!r.available} onClick={() => onToggleLayer(r.id)}>
                {r.on ? `Hide ${r.label}` : `Show ${r.label}`}
              </button>
              {!r.available && <span className="italic text-cc-faint">{r.sub}</span>}
            </div>
          ))}
          {showNight && <div className="flex flex-wrap items-center gap-2 text-xs">
            <button type="button" className={btn} disabled={!nightLights.pair} onClick={onCompareNightLights}>
              Night lights before / after
            </button>
            {!nightLights.pair && <span className="italic text-cc-faint">{nightLights.reason}</span>}
          </div>}
        </div>
      </div>}
    </div>
  );
}
