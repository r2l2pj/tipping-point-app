"use client";

import { PASSES_SHOWN, type RadarCard as RadarModel } from "./model/radar";
import { fmtBrt } from "./model/format";
import { Icon, ICON } from "./ui";

// Radar confirmation. "NISAR" is only said for a real pair; scars are always
// "candidates". "Confirm with NISAR radar" opens the confirmation on the map
// and does not move the timeline.
export default function RadarCard({
  radar,
  floodOn,
  compareOpen,
  onConfirm,
  onShowFlood,
  onCompare,
}: {
  radar: RadarModel;
  floodOn: boolean;
  compareOpen: boolean;
  onConfirm: () => void;
  onShowFlood: () => void;
  onCompare: () => void;
}) {
  const primary = "inline-flex items-center gap-1.5 rounded-lg bg-cc-accent px-2.5 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
  const secondary = "inline-flex items-center rounded-lg border border-cc-line-strong bg-cc-surface px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <section aria-label="Radar check" className="rounded-[10px] border border-cc-line px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <Icon d={ICON.radar} size={30} strokeWidth={1.8} className="shrink-0" />
        <div className="shrink-0">
          <div className="text-[15px] font-semibold leading-tight">{radar.pair ? "NISAR radar" : "Radar"}</div>
          <div className="text-xs text-cc-muted">Post-event radar check</div>
        </div>
        <div className="min-w-0 flex-[1_1_150px] border-l border-cc-line pl-2.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <span aria-hidden="true" className={`h-[9px] w-[9px] shrink-0 rounded-full ${radar.pair ? "bg-cc-accent" : "bg-[#9aa7a0]"}`} />
            {radar.headline}
          </div>
          {radar.dates && <div className="text-xs text-cc-muted">Passes: {radar.dates}</div>}
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
        {radar.flooded && (
          <div>
            <dt className="text-xs text-cc-muted">{radar.flooded.label}</dt>
            <dd className="font-semibold">{radar.flooded.value}</dd>
            {radar.flooded.swath && <dd className="text-xs text-cc-faint">{radar.flooded.swath}</dd>}
          </div>
        )}
        {radar.people && (
          <div>
            <dt className="text-xs text-cc-muted">{radar.people.label}</dt>
            <dd className="font-semibold">{radar.people.value}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-cc-muted">{radar.candidates.label}</dt>
          <dd className="font-semibold">{radar.candidates.value}</dd>
        </div>
      </dl>
      {/* Scar candidates: figures, lag and caveat right under the count. */}
      {radar.candidates.lines?.map((l) => (
        <p key={l} className={`mt-1 text-xs ${l.startsWith("Caveat:") ? "text-cc-warn" : "text-cc-muted"}`}>{l}</p>
      ))}
      {radar.others?.map((o) => (
        <p key={o.label} className="mt-1 text-[13px]">
          <span className="text-xs text-cc-muted">{o.label}:</span> <span className="font-semibold">{o.value}</span>
        </p>
      ))}
      {radar.note && <p className="mt-1 text-xs text-cc-muted">{radar.note}</p>}
      <p className="mt-1 text-xs text-cc-faint">{radar.candidates.note}</p>
      {radar.limitation && <p className="mt-1 text-xs text-cc-muted">{radar.limitation}</p>}

      {radar.passes.length > 0 && (
        <div className="mt-2 border-t border-cc-rule pt-1.5">
          <p className="text-xs font-semibold">Recent NISAR passes over the area</p>
          <ul>
            {radar.passes.slice(0, PASSES_SHOWN).map((p, i) => (
              <li key={i} className="flex justify-between text-xs text-cc-muted">
                <span>{fmtBrt(p.date)}{p.track ? ` · track ${p.track}` : ""}</span>
                {p.note && <span className="text-cc-faint">{p.note}</span>}
              </li>
            ))}
            {radar.passCount > PASSES_SHOWN && (
              <li className="text-xs text-cc-faint">
                and {radar.passCount - PASSES_SHOWN} older passes
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {radar.pair && (
          <button type="button" onClick={onConfirm} disabled={!radar.canShowOnMap} className={primary}>
            Check with NISAR radar <Icon d={ICON.arrowRight} size={14} strokeWidth={2.2} />
          </button>
        )}
        <button type="button" onClick={onShowFlood} aria-pressed={floodOn} disabled={!radar.canShowOnMap} className={secondary}>
          {floodOn ? "Hide on map" : "Show on map"}
        </button>
        <button type="button" onClick={onCompare} aria-pressed={compareOpen} disabled={!radar.compare.pair} className={secondary}>
          Before / after
        </button>
        {!radar.compare.pair && radar.compare.reason && (
          <span className="text-xs italic text-cc-faint">Before / after: {radar.compare.reason}</span>
        )}
      </div>
    </section>
  );
}
