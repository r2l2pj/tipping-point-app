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
import { OPACITY_DEFAULT, OPACITY_MIN } from "./state";
import { Icon, ICON } from "./ui";

const GROUPS: LayerGroup[] = ["Analysis", "Observations", "Replay evidence"];

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
  opacity = OPACITY_DEFAULT,
  onOpacity,
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
  // Opacity of the data rasters (0 to 1) and its control; without the
  // handler the control is not drawn.
  opacity?: number;
  onOpacity?: (value: number) => void;
  className?: string;
}) {
  // Collapsing hides the rows only; the legend stays visible (rule 3).
  const [open, setOpen] = useState(true);
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
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pr-1">
          <div className="mt-1 border-t border-cc-rule pb-1.5 pt-3 text-sm font-semibold">Hazards</div>
          <div role="radiogroup" aria-label="Hazard" className="flex flex-col gap-1">
            {(["slide", "flood"] as Hazard[]).map((h) => {
              const has = caseHasHazard(bundle, h);
              return (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={hazard === h}
                  disabled={!has}
                  onClick={() => onHazard(h)}
                  className="flex min-h-9 items-center gap-2.5 rounded-lg px-1 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <span aria-hidden="true" className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${hazard === h ? "border-cc-accent" : "border-cc-line-strong"}`}>
                    {hazard === h && <span className="h-2.5 w-2.5 rounded-full bg-cc-accent" />}
                  </span>
                  <span className="leading-tight">
                    {HAZARD_LABEL[h]} risk
                    {!has && <span className="block text-xs text-cc-faint">no map layer for this case</span>}
                  </span>
                </button>
              );
            })}
          </div>

          {onOpacity && (
            <label className="mt-1 block border-t border-cc-rule pb-1 pt-3 text-[13px]" data-opacity>
              <span className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">Layer opacity</span>
                <span className="tabular-nums text-cc-muted">{Math.round(opacity * 100)}%</span>
              </span>
              <input
                type="range"
                min={OPACITY_MIN * 100}
                max={100}
                step={5}
                value={Math.round(opacity * 100)}
                onChange={(e) => onOpacity(Number(e.target.value) / 100)}
                aria-valuetext={`${Math.round(opacity * 100)} percent`}
                className="mt-1 block w-full accent-cc-accent"
              />
              <span className="block text-xs text-cc-faint">Lower it to see the map under the data.</span>
            </label>
          )}

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
        </div>
      )}

      <Legend bundle={bundle} layers={layers} hazard={hazard} stepDate={stepDate} probHorizon={probHorizon} className="mt-2 shrink-0 border-t border-cc-rule pt-2.5" />
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
      {tpiOn && <div className={`mb-1.5 font-semibold ${compact ? "text-xs" : "text-sm"}`}>{legendTitle(hazard, compact)}</div>}
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
        {layerLegendRows(bundle, layers, probHorizon).map((r) => (
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

// "TPI" is the Tipping Point Index: the full legend spells it out once, and
// never says "TPI index". The compact legend on the map keeps the short form.
export const legendTitle = (hazard: Hazard, compact = false) =>
  compact
    ? `TPI · ${HAZARD_LABEL[hazard]} risk class`
    : `Tipping Point Index (TPI) · ${HAZARD_LABEL[hazard]} risk class`;

export const legendSource = (stepDate?: string) =>
  `TPI 0–1 from NASA GPM IMERG rain, SMAP soil moisture and NASADEM terrain${stepDate ? ` · ${fmtDataDate(stepDate)}` : ""}`;
