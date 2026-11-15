"use client";

import { PASSES_SHOWN, type RadarCard as RadarModel } from "./model/radar";
import { fmtBrt, fmtDate } from "./model/format";
import NisarSeriesChart from "./NisarSeriesChart";
import { Icon, ICON } from "./ui";
import { isMissingText } from "./model/sparse";

// Radar confirmation. "NISAR" is only said for a real pair; scars are always
// "candidates". "Confirm with NISAR radar" opens the confirmation on the map
// and does not move the timeline.
// Judge report #3: the physical drivers behind the radar layer, in plain words.
// L42 (conductor): two visible lines, the rest stays in "What NISAR sees and why".
export const RADAR_SEES = [
  "Dark = open water: smooth water reflects the radar away from the satellite.",
  "Flooded towns and forests stay or turn BRIGHT (double bounce), so this map may miss them.",
];
export const NISAR_WHY = [
  "NISAR's L-band radar sees through cloud and at night: the flood is mapped even when optical satellites see only cloud.",
  "Open water is smooth and reflects the radar away, so it turns dark. We map water that turned dark between two passes, on low ground near rivers.",
  "Flooded towns and forests can turn bright instead (the radar bounces between water and walls or trunks), so a dark-water map can miss them.",
  "NISAR passes over the same place every 12 days; the map updates with each new pass.",
];

export default function RadarCard({
  radar,
  floodOn,
  compareOpen,
  onConfirm,
  onShowFlood,
  onCompare,
  hideMissing = false,
  swipeDates,
}: {
  radar: RadarModel;
  hideMissing?: boolean; // featured replay: no "pending" scar block (conductor, v6)
  // Lucas: the NISAR dates of the open swipe, as chips (no slider).
  swipeDates?: { dates: string[]; before: string; after: string; onPick: (before: string, after: string) => void };
  floodOn: boolean;
  compareOpen: boolean;
  onConfirm: () => void;
  onShowFlood: () => void;
  onCompare: () => void;
}) {
  const noCandidates = hideMissing && isMissingText(radar.candidates.value) && !radar.candidates.lines?.length;
  const primary = "inline-flex items-center gap-1.5 rounded-lg bg-cc-accent px-2.5 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
  const secondary = "inline-flex items-center rounded-lg border border-cc-line-strong bg-cc-surface px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <section aria-label="Radar check" className="rounded-[10px] border border-cc-line px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <Icon d={ICON.radar} size={30} strokeWidth={1.8} className="shrink-0" />
        <div className="shrink-0">
          <div className="text-[15px] font-semibold leading-tight">{radar.pair && radar.nisar ? "NISAR radar" : "Radar"}</div>
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
        {!noCandidates && (
          <div>
            <dt className="text-xs text-cc-muted">{radar.candidates.label}</dt>
            <dd className="font-semibold">{radar.candidates.value}</dd>
          </div>
        )}
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
      {!noCandidates && <p className="mt-1 text-xs text-cc-faint">{radar.candidates.note}</p>}
      {radar.limitation && <p className="mt-1 text-xs text-cc-muted">{radar.limitation}</p>}

      {radar.pair && (
        <div className="mt-1.5 rounded-md bg-cc-well px-2 py-1 text-xs" data-radar-sees>
          <p className="m-0 font-semibold">What the radar sees</p>
          {RADAR_SEES.map((l) => <p key={l} className="m-0 text-cc-muted">{l}</p>)}
          {radar.hypothesisLine && <p className="m-0 mt-0.5 font-semibold" data-radar-test>{radar.hypothesisLine}</p>}
        </div>
      )}
      {radar.nextLook && (
        <div className="mt-1.5 text-xs" data-next-look>
          <p className="m-0 font-semibold">{radar.nextLook}</p>
          {radar.framing && <p className="m-0 text-cc-muted">{radar.framing}</p>}
        </div>
      )}
      {radar.series && <NisarSeriesChart s={radar.series} />}
      {radar.extras.length > 0 && (
        <div className="mt-2 border-t border-cc-rule pt-1.5 text-xs" data-nisar-extras>
          <p className="m-0 font-semibold">More NISAR products</p>
          {radar.extras.map((x) => (
            <figure key={x.id} className="m-0 mt-1.5">
              <figcaption className="font-medium">{x.label}{x.date ? ` · ${x.date}` : ""}</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element -- data PNG from the manifest */}
              <img src={x.url} alt={x.label} loading="lazy" className="mt-0.5 h-auto w-full rounded border border-cc-line bg-black" />
              {x.legend.length > 0 && (
                <ul className="m-0 mt-0.5 flex list-none flex-wrap gap-x-3 p-0 text-cc-muted">
                  {x.legend.map((g) => (
                    <li key={g.label}><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: g.color }} />{g.label}</li>
                  ))}
                </ul>
              )}
              {x.note && <p className="m-0 mt-0.5 text-cc-muted">{x.note}</p>}
              {x.attribution && <p className="m-0 mt-0.5 text-cc-faint">{x.attribution}</p>}
            </figure>
          ))}
        </div>
      )}
      {radar.pair && (
        <details className="mt-1.5 text-xs" data-nisar-why>
          <summary className="cursor-pointer font-semibold">What NISAR sees and why</summary>
          {/* eslint-disable-next-line @next/next/no-img-element -- static explainer in public/ */}
          <img src="/explainer/what-nisar-sees.png" width={1600} height={900} loading="lazy" data-explainer
            alt="What NISAR radar sees: calm open water reflects the pulse away and looks dark; a flooded town or forest bounces it back twice (water, then wall or trunk) and looks bright, so a dark-means-water rule can miss it; L-band sees through cloud and rain, day and night; HH sees surface and double bounce, HV sees volume scatter in vegetation."
            className="mt-1 h-auto w-full rounded border border-cc-line" />
          <ul className="m-0 mt-1 list-disc pl-4 text-cc-muted">
            {NISAR_WHY.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </details>
      )}

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
            {radar.nisar ? "Check with NISAR radar" : "Check with radar"} <Icon d={ICON.arrowRight} size={14} strokeWidth={2.2} />
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
        {swipeDates && <SwipeDatePicker {...swipeDates} />}
      </div>
    </section>
  );
}

// Before / after dates as chips: one tap each; picking a 'before' on or after
// the current 'after' moves 'after' to the next date (never a dead chip).
function SwipeDatePicker({ dates, before, after, onPick }: { dates: string[]; before: string; after: string; onPick: (b: string, a: string) => void }) {
  const chip = (on: boolean) => `rounded-md px-2 py-0.5 text-xs font-semibold ${on ? "bg-cc-accent text-white" : "border border-cc-line-strong"}`;
  const short = (d: string) => fmtDate(d).replace(/,\s*\d{4}$/, "");
  const next = (d: string) => dates.find((x) => x > d) ?? d;
  const prev = (d: string) => [...dates].reverse().find((x) => x < d) ?? d;
  return (
    <div className="mt-1.5 grid w-full gap-1 text-xs" data-swipe-dates>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Radar date before">
        <span className="w-12 text-cc-muted">Before</span>
        {dates.map((d) => (
          <button key={d} type="button" aria-pressed={d === before} className={chip(d === before)}
            onClick={() => onPick(d, d >= after ? next(d) : after)}>{short(d)}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Radar date after">
        <span className="w-12 text-cc-muted">After</span>
        {dates.map((d) => (
          <button key={d} type="button" aria-pressed={d === after} className={chip(d === after)}
            onClick={() => onPick(d <= before ? prev(d) : before, d)}>{short(d)}</button>
        ))}
      </div>
    </div>
  );
}
