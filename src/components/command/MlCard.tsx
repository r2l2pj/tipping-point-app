"use client";

import { useState } from "react";
import { FEW_POSITIVES, SOURCE_LABEL, type MlTable, type MlView } from "./model/ml";

const caseTitle = (id?: string) => (id === "rs_2024" ? "RS 2024" : id === "wa_2025" ? "WA 2025" : id ?? "this event");

function Table({ t, caption }: { t: MlTable; caption: string }) {
  if (t.reason) return <p className="text-xs italic text-cc-faint">{caption}: not evaluated ({t.reason}).</p>;
  if (!t.rows.length) return null;
  const th = "px-1 py-px text-right font-semibold";
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
                    n {r.n?.toLocaleString("en-US")}{r.nPos !== undefined ? ` · ${r.nPos} positive` : ""}
                  </span>
                )}
              </th>
              {r.missing ? (
                <td colSpan={5} className="px-1 py-px text-right italic text-cc-faint">n not reported</td>
              ) : (
                <>
                  <td className="px-1 py-px text-right">{r.cells.precision}</td>
                  <td className="px-1 py-px text-right">{r.cells.recall}</td>
                  <td className="px-1 py-px text-right">{r.cells.f1}</td>
                  <td className="px-1 py-px text-right">{r.cells.prAuc}</td>
                  <td className="px-1 py-px text-right">{r.cells.rocAuc}</td>
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
          {ml.event[key] && (
            <div className="mt-1.5">
              <Table t={ml.event[key]} caption={`This event only (${caseTitle(ml.eventId)})`} />
            </div>
          )}
          {ml.split3b && <p className="mt-1 text-cc-faint">TEST: {ml.split3b}</p>}
        </div>
      )}

      {ml.where && (
        <div className="mt-2 border-t border-cc-rule pt-1.5">
          <p className="font-semibold">Where: landslide-prone ground (T_ML susceptibility)</p>
          <div className="mt-1"><Table t={ml.where} caption="TEST blocks" /></div>
          {ml.split3a && <p className="mt-1 text-cc-faint">TEST: {ml.split3a}</p>}
        </div>
      )}
    </section>
  );
}
