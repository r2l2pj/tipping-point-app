"use client";

import { useState } from "react";
import {
  isLongRange,
  LONG_RANGE_NOTE,
  probFrame,
  horizonLabel,
  probHorizonsAvailable,
  probLayerNote,
  type ProbHorizon,
} from "@/lib/layers";
import {
  BUDGET_RULE_TEXT, ML_SKILL_LINE, mlHorizonTip, REFERENCE_TEXT, type LayerGroup, type LayerId, type LayerRow,
} from "./model/layerRegistry";
import { classRows, HATCH_SWATCH, layerLegendRows } from "./model/legend";
import { fmtDataDate } from "./model/format";
import { caseHasHazard } from "./model/steps";
import { HAZARD_LABEL, type CcBundle, type Hazard } from "./model/types";
import { Icon, ICON } from "./ui";
import { activeView, viewLayers, VIEWS, type ViewId } from "./model/views";

const GROUPS: LayerGroup[] = ["Analysis", "Observations", "Replay evidence"];
const VIEW_ICON: Record<ViewId, string> = {
  risk: ICON.warn,
  rain: "M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z",
  radar: ICON.radar,
  satellite: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
};

export default function LayersColumn({
  bundle,
  rows,
  hazard,
  layers,
  notice,
  probHorizon,
  stepDate,
  onHazard,
  onToggle,
  onProbHorizon,
  onClose,
  onView,
  satellite,
  className = "",
}: {
  bundle: CcBundle;
  rows: LayerRow[];
  hazard: Hazard;
  layers: readonly LayerId[];
  notice: string | null;
  probHorizon: ProbHorizon;
  stepDate?: string; // date of the selected step, for the probability frame note
  onHazard: (h: Hazard) => void;
  onToggle: (id: LayerId) => void;
  onProbHorizon: (h: ProbHorizon) => void;
  onClose: () => void;
  onView?: (v: ViewId) => void;
  // U3 basemap: the 'Satellite' view (absent until the basemap switcher exists).
  satellite?: { on: boolean; toggle: () => void };
  className?: string;
}) {
  // Collapsing hides the rows only; the legend stays visible (rule 3).
  const [open, setOpen] = useState(true);
  const current = activeView(layers);
  const views = VIEWS.filter((v) => v.id === "satellite" ? !!satellite : viewLayers(bundle, hazard, v.id).length > 0);
  const probHorizons = probHorizonsAvailable(bundle.manifest?.layers);
  return (
    <aside
      aria-label="Map layers"
      className={`max-h-full w-[236px] shrink-0 flex-col rounded-xl min-[900px]:shadow-[0_4px_18px_rgba(0,0,0,0.28)] border border-cc-line bg-cc-surface px-3.5 py-2.5 max-[899px]:fixed max-[899px]:inset-y-0 max-[899px]:left-0 max-[899px]:z-40 max-[899px]:w-[280px] max-[899px]:rounded-none max-[899px]:shadow-2xl ${className}`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex grow items-center gap-3 py-1.5 text-left text-[17px] font-semibold"
        >
          <Icon d={ICON.layers} size={24} />
          <span className="grow">Layers</span>
          <Icon d={ICON.chevronUp} strokeWidth={2.2} className={open ? "" : "rotate-180"} />
        </button>
        <button type="button" onClick={onClose} aria-label="Close the Layers column" className="rounded-lg p-1.5 min-[900px]:hidden">
          <Icon d={ICON.close} />
        </button>
      </div>

      {open && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
          {/* L52 U1: big views first, one tap each. */}
          {onView && views.length > 0 && (
            <div role="radiogroup" aria-label="Map view" className="mt-1 flex flex-col gap-1.5 border-t border-cc-rule pt-2.5" data-views>
              {views.map((v) => {
                const on = v.id === "satellite" ? !!satellite?.on : current === v.id;
                return (
                  <button key={v.id} type="button" role="radio" aria-checked={on} data-view-id={v.id}
                    onClick={() => (v.id === "satellite" ? satellite?.toggle() : onView(v.id))}
                    className={`flex min-h-12 items-center gap-2.5 rounded-xl border-2 px-2.5 py-1.5 text-left ${on ? "border-cc-accent bg-cc-accent-soft" : "border-cc-line hover:border-cc-line-strong"}`}>
                    <Icon d={VIEW_ICON[v.id]} size={22} className={on ? "text-cc-accent" : "text-cc-muted"} />
                    <span className="leading-tight">
                      <span className="block text-[15px] font-semibold">{v.label}</span>
                      <span className="block text-xs text-cc-muted">{v.line}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div role="radiogroup" aria-label="Hazard" className="mt-2 grid grid-cols-2 gap-1.5">
            {(["flood", "slide"] as Hazard[]).map((h) => {
              const has = caseHasHazard(bundle, h);
              return (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={hazard === h}
                  disabled={!has}
                  title={has ? undefined : "no map layer for this case"}
                  onClick={() => onHazard(h)}
                  className={`min-h-10 rounded-xl border-2 px-2 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${hazard === h ? "border-cc-accent bg-cc-accent text-white" : "border-cc-line"}`}
                >
                  {h === "flood" ? "Flood" : "Landslide"}
                </button>
              );
            })}
          </div>

          <Legend bundle={bundle} layers={layers} hazard={hazard} stepDate={stepDate} probHorizon={probHorizon} className="mt-2.5 shrink-0" />

          <details className="mt-2 border-t border-cc-rule pt-1.5" data-more-layers>
            <summary className="cursor-pointer py-1 text-sm font-semibold">More layers (advanced)</summary>
          {GROUPS.map((group) => {
            const groupRows = rows.filter((r) => r.group === group);
            if (!groupRows.length) return null;
            return (
              <div key={group}>
                <div className="mt-1 border-t border-cc-rule pb-1.5 pt-3 text-sm font-semibold">{group}</div>
                {groupRows.map((r) => {
                  const prob = r.id === "ptrigger" && r.available;
                  // The probability note follows the selected horizon; the
                  // row's own sub carries the default one.
                  const sub = prob
                    ? probLayerNote(probFrame(bundle.manifest?.layers, probHorizon, stepDate)) ?? r.sub
                    : r.sub;
                  return (
                  <div key={r.id} className="flex min-h-10 items-center gap-2.5 py-0.5">
                    <span className={`min-w-0 flex-1 text-[13px] leading-tight ${r.available ? "" : "text-cc-muted"}`}>
                      {r.label}
                      {sub && <span className="block text-xs text-cc-faint">{sub}</span>}
                      {prob && (
                        <span className="block text-xs" data-ml-skill>
                          <span className="font-semibold text-cc-warn">Experimental</span>{" "}
                          <span className="text-cc-muted">{ML_SKILL_LINE}</span>
                        </span>
                      )}
                      {prob && probHorizons.length > 0 && (
                        <span role="radiogroup" aria-label="Horizon" className="mt-1 flex flex-wrap gap-1">
                          {probHorizons.map((h) => (
                            <button
                              key={h}
                              type="button"
                              role="radio"
                              aria-checked={h === probHorizon}
                              title={mlHorizonTip(h,
                                typeof bundle.data_dates?.imerg_obs_through === "string" ? bundle.data_dates.imerg_obs_through as string : undefined,
                                typeof bundle.data_dates?.gfs_issued === "string" ? bundle.data_dates.gfs_issued as string : undefined)}
                              onClick={() => onProbHorizon(h)}
                              className={`rounded border px-1.5 py-0.5 text-xs ${
                                h === probHorizon
                                  ? "border-cc-accent text-cc-accent"
                                  : "border-cc-line-strong text-cc-muted hover:text-cc-ink"
                              }`}
                            >
                              {horizonLabel(h)}
                            </button>
                          ))}
                        </span>
                      )}
                      {prob && isLongRange(probHorizon, probFrame(bundle.manifest?.layers, probHorizon, stepDate) as { low_skill?: unknown } | undefined) && (
                        <span className="mt-1 block text-xs font-medium text-cc-warn">{LONG_RANGE_NOTE}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.on}
                      aria-disabled={!r.available}
                      disabled={!r.available}
                      aria-label={r.available ? r.label : `${r.label}: ${r.sub ?? "no data"}`}
                      onClick={() => onToggle(r.id)}
                      className={`relative h-[22px] w-[38px] shrink-0 rounded-full border-[1.5px] ${
                        r.on ? "border-cc-accent bg-cc-accent" : "border-[#9aa7a0] bg-[#c9d1cb]"
                      } ${r.available ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                    >
                      <span aria-hidden="true" className={`absolute top-[2px] h-[15px] w-[15px] rounded-full bg-white shadow-[0_0_0_1px_rgba(22,36,43,0.25)] transition-[left] ${r.on ? "left-[19px]" : "left-[2px]"}`} />
                    </button>
                  </div>
                  );
                })}
              </div>
            );
          })}

          <p aria-live="polite" className={`mt-1.5 rounded-md px-2 py-1 text-xs font-semibold ${notice ? "bg-cc-warn-soft text-cc-warn" : "sr-only"}`}>
            {notice ?? ""}
          </p>
          <p className="pt-1 text-xs text-cc-faint">{BUDGET_RULE_TEXT}</p>
          <p className="pt-1 text-xs text-cc-faint">{REFERENCE_TEXT}</p>
          </details>
        </div>
      )}

      {!open && <Legend bundle={bundle} layers={layers} hazard={hazard} stepDate={stepDate} probHorizon={probHorizon} className="mt-2 shrink-0 border-t border-cc-rule pt-2.5" />}
    </aside>
  );
}

// Always visible: in the column, or as the compact legend on the map.
export function Legend({
  bundle,
  layers,
  hazard,
  stepDate,
  probHorizon = "24h",
  compact = false,
  className = "",
}: {
  bundle: CcBundle;
  layers: readonly LayerId[];
  hazard: Hazard; // named in the title: the raster is one hazard at a time
  stepDate?: string; // the frame on the map: the legend names its date (rule 3)
  probHorizon?: string; // ML horizon on the map (its 'low today' stats)
  compact?: boolean;
  className?: string;
}) {
  const swatch = "inline-block h-4 w-[22px] shrink-0 rounded-[3px]";
  const tpiOn = layers.includes("tpi");
  return (
    <div className={className} data-legend={compact ? "compact" : "full"}>
      {/* The TPI classes only when the TPI is on (Now's ML view has its own
          legend row; two scales on screen contradict each other). */}
      {tpiOn && <div className={`mb-1.5 font-semibold ${compact ? "text-xs" : "text-sm"}`}>TPI - {HAZARD_LABEL[hazard]} risk class</div>}
      <div className={`flex flex-col gap-1 ${compact ? "text-xs" : "text-[13px]"}`}>
        {tpiOn && classRows(bundle).map((c) => (
          <span key={c.key} className="inline-flex items-center gap-2.5">
            <span aria-hidden="true" className={swatch} style={{ background: c.color, border: c.key === "low" ? "1px solid #cfcf7a" : undefined }} />
            {c.label} ({c.range})
          </span>
        ))}
        {tpiOn && (
          <span className="inline-flex items-center gap-2.5">
            <span aria-hidden="true" className={swatch} style={{ background: HATCH_SWATCH }} />
            Hatched: forecast
          </span>
        )}
        {layerLegendRows(bundle, layers, probHorizon, stepDate).map((r) => r.note ? (
          <span key={r.id} className="pl-[32px] text-xs text-cc-muted" data-legend-note>{r.label}</span>
        ) : (
          <span key={r.id} className="inline-flex items-center gap-2.5">
            <span aria-hidden="true" className={r.round ? "mx-[6px] inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black" : `${swatch} border border-[#9aa7a0]`} style={{ background: r.swatch }} />
            {r.label}
          </span>
        ))}
      </div>
      {/* Rule 3: units, NASA source and date with the legend. */}
      {tpiOn && (
        <p className="mt-1.5 text-xs text-cc-muted" data-legend-source>
          {legendSource(stepDate)}
        </p>
      )}
    </div>
  );
}

export const legendSource = (stepDate?: string) =>
  `TPI 0–1 from NASA GPM IMERG rain, SMAP soil moisture and NASADEM terrain${stepDate ? ` · ${fmtDataDate(stepDate)}` : ""}`;
