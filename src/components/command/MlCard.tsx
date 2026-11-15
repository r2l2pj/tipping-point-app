"use client";

import { useState } from "react";
import {
  FEW_POSITIVES, ML_PROVISIONAL_TEXT, mlCaveats, SOURCE_LABEL, spreadFor, spreadLine, TML_RETRAIN_NOTE,
  type MlTable, type MlView,
} from "./model/ml";

const caseTitle = (id?: string) => (id === "rs_2024" ? "RS 2024" : id === "wa_2025" ? "WA 2025" : id ?? "this event");
// v2: T_ML retrained without RS (L32); its TEST changed, so no v1 comparison.
const TML_V2_NOTE = "Retrained without any Rio Grande do Sul 2024 point. TEST = held-out Brazilian event landslides vs random land — not comparable to the earlier version.";

function Table({ t, caption }: { t: MlTable; caption: string }) {
  if (t.reason) return <p className="text-xs italic text-cc-faint">{caption}: not evaluated ({t.reason}).</p>;
  if (!t.rows.length) return null;
  const th = "px-1 py-px text-right font-semibold";
  const hasVal = t.rows.some((r) => r.valPrAuc !== undefined);
  return (
    <div>
      <table className="w-full border-collapse text-xs tabular-nums" aria-label={caption}>
        <caption className="pb-0.5 text-left text-xs text-cc-muted">{caption}</caption>
        <thead>
          <tr className="text-cc-muted">
            <th scope="col" className="px-1 py-px text-left font-semibold">Model</th>
            <th scope="col" className={th}>Precision</th>
            <th scope="col" className={th}>Recall</th>
            <th scope="col" className={th}>F1</th>
            <th scope="col" className={th}>PR-AUC</th>
            <th scope="col" className={th}>ROC-AUC</th>
            {hasVal && <th scope="col" className={`${th} border-l border-cc-rule`} title="PR-AUC on the VAL split (held-out catalog events)">VAL PR-AUC</th>}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.model} className="border-t border-cc-rule">
              <th scope="row" className="px-1 py-px text-left font-medium">
                {r.label}
                {/* The sample size sits with every score (never a metric without n). */}
                {!r.missing && (
                  <span className="block font-normal text-cc-faint">
                    n {r.n?.toLocaleString("en-US")}{r.nPos !== undefined ? ` · ${r.nPos.toLocaleString("en-US")} positive` : ""}
                  </span>
                )}
              </th>
              {r.missing ? (
                <td colSpan={hasVal ? 6 : 5} className="px-1 py-px text-right italic text-cc-faint">n not reported</td>
              ) : (
                <>
                  <td className="px-1 py-px text-right">{r.cells.precision}</td>
                  <td className="px-1 py-px text-right">{r.cells.recall}</td>
                  <td className="px-1 py-px text-right">{r.cells.f1}</td>
                  <td className="px-1 py-px text-right">{r.cells.prAuc}</td>
                  <td className="px-1 py-px text-right">{r.cells.rocAuc}</td>
                  {hasVal && <td className="border-l border-cc-rule px-1 py-px text-right text-cc-muted">{r.valPrAuc ?? "—"}</td>}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {t.baseLine && <p className="mt-0.5 text-xs text-cc-muted">{t.baseLine}</p>}
      {t.fewPositives && (
        <p className="text-xs text-cc-warn">Fewer than {FEW_POSITIVES} positive samples: these scores are fragile.</p>
      )}
    </div>
  );
}

// "Did we get it right?" — TEST-split scores of the landslide models next to
// the TPI > 0.6 rule. NOAA GFS forecast rain is the headline; observed rain
// is only the upper bound.
export default function MlCard({ ml }: { ml: MlView }) {
  const [h, setH] = useState(ml.horizons.includes("72h") ? "72h" : ml.horizons[0]);
  const [src, setSrc] = useState(ml.sources[0]);
  const key = `${h}|${src}`;
  const btn = (on: boolean) =>
    `rounded-md px-1.5 py-0.5 text-xs font-semibold ${on ? "bg-cc-accent text-white" : "border border-cc-line-strong"}`;
  return (
    <section aria-label="Did we get it right?" data-ml-card className="rounded-lg border border-cc-line p-2.5 text-xs">
      <h3 className="m-0 text-[13px] font-semibold">Did we get it right? (TEST data the models never saw)</h3>
      {ml.provisional && (
        <p role="status" data-ml-provisional className="mt-1 rounded-md border border-[#e2c48a] bg-cc-warn-soft px-2 py-1 text-[13px] font-semibold text-cc-warn">
          {ML_PROVISIONAL_TEXT}
        </p>
      )}
      {ml.headlineHeld && (
        <p role="status" data-ml-held className="mt-1 rounded-md border border-[#e2c48a] bg-cc-warn-soft px-2 py-1 text-[13px] font-semibold text-cc-warn">
          {ml.headlineHeld}
        </p>
      )}
      {ml.version && !ml.provisional && (
        <p data-ml-version className="mt-1 text-cc-muted">Model version {ml.version} · re-scored on {ml.testEventList.length || ml.testEvents.length} unseen events</p>
      )}
      {/* lead-ml's caveats first, in plain words. */}
      <ul className="m-0 mt-1 list-disc pl-4 text-cc-warn" data-ml-caveats>
        {mlCaveats(ml).map((c) => <li key={c}>{c}</li>)}
      </ul>

      {ml.horizons.length > 0 && (
        <div className="mt-1.5">
          <p className="font-semibold">When: landslide in the next…</p>
          <div className="mt-1 flex flex-wrap items-center gap-1" role="group" aria-label="Horizon">
            {ml.horizons.map((x) => (
              <button key={x} type="button" aria-pressed={x === h} onClick={() => setH(x)} className={btn(x === h)}>{x}</button>
            ))}
          </div>
          {ml.sources.length > 1 && (
            <div className="mt-1 flex flex-wrap items-center gap-1" role="group" aria-label="Rain used">
              <span className="text-cc-muted">Rain:</span>
              {ml.sources.map((s) => (
                <button key={s} type="button" aria-pressed={s === src} onClick={() => setSrc(s)} className={btn(s === src)}>
                  {SOURCE_LABEL[s] ?? s}
                </button>
              ))}
            </div>
          )}
          {ml.lowSkill.includes(h) && (
            <p className="mt-1 text-cc-warn">Lower confidence: long-range forecast ({h}).</p>
          )}
          <div className="mt-1.5">
            {ml.when[key] && <Table t={ml.when[key]} caption={`All TEST events · ${h} · ${SOURCE_LABEL[src] ?? src}`} />}
          </div>
          {(() => {
            const sp = spreadFor(ml, h, src);
            if (!sp) return null;
            return (
              <ul data-ml-spread className="m-0 mt-1 list-none pl-0 text-cc-muted">
                {sp.rows.map((r) => <li key={r.model}><span className="font-medium text-cc-ink">{r.label}</span>: {spreadLine(r, sp.source)}</li>)}
              </ul>
            );
          })()}
          {ml.event[key] && (
            <div className="mt-1.5">
              <Table t={ml.event[key]} caption={`This event only (${caseTitle(ml.eventId)})`} />
              {ml.eventNote && <p data-ml-eventnote className="mt-0.5 text-cc-warn">{ml.eventNote}</p>}
            </div>
          )}
          {ml.valNote && <p data-ml-valnote className="mt-1 text-cc-warn">{ml.valNote}</p>}
          {ml.servedLine && (
            <p className="mt-1 text-cc-muted">{ml.servedLine}{ml.servedNote ? ` ${ml.servedNote}` : ""}</p>
          )}
          {ml.split3b && <p className="mt-1 text-cc-faint">TEST: {ml.split3b}</p>}
          {ml.testEventList.length > 0 && (
            <details data-ml-events className="mt-1 text-cc-muted">
              <summary className="cursor-pointer">TEST events ({ml.testEventList.length})</summary>
              <ul className="m-0 list-disc pl-4">
                {ml.testEventList.map((e) => (
                  <li key={e.id}>{e.name}{e.nPos !== undefined ? ` · ${e.nPos.toLocaleString("en-US")} positive` : ""}{e.source ? ` · ${e.source}` : ""}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {ml.where && (
        <div className="mt-2 border-t border-cc-rule pt-1.5">
          <p className="font-semibold">Where: landslide-prone ground (T_ML susceptibility)</p>
          <div className="mt-1"><Table t={ml.where} caption="TEST blocks" /></div>
          {/* L32 (conductor): the terrain model is being retrained without the
              RS 2024 points; this table and the T_ML layer stay meanwhile. */}
          {ml.tmlExcludesRs
            ? <p className="mt-1 text-cc-muted" data-tml-v2>{TML_V2_NOTE}</p>
            : <p className="mt-1 text-cc-warn">{TML_RETRAIN_NOTE}</p>}
          {ml.calibrationNote && <p className="mt-1 text-cc-muted">{ml.calibrationNote}</p>}
          {ml.split3a && <p className="mt-1 text-cc-faint">TEST: {ml.split3a}</p>}
        </div>
      )}
    </section>
  );
}
