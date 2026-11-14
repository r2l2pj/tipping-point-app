"use client";

import { useState } from "react";
import {
  BUDGET_RULE_TEXT, REFERENCE_TEXT, type LayerGroup, type LayerId, type LayerRow,
} from "./model/layerRegistry";
import { classRows, HATCH_SWATCH, layerLegendRows } from "./model/legend";
import { caseHasHazard } from "./model/steps";
import { HAZARD_LABEL, type CcBundle, type Hazard } from "./model/types";
import { Icon, ICON } from "./ui";

const GROUPS: LayerGroup[] = ["Analysis", "Observations", "Replay evidence"];

export default function LayersColumn({
  bundle,
  rows,
  hazard,
  layers,
  notice,
  onHazard,
  onToggle,
  onClose,
  className = "",
}: {
  bundle: CcBundle;
  rows: LayerRow[];
  hazard: Hazard;
  layers: readonly LayerId[];
  notice: string | null;
  onHazard: (h: Hazard) => void;
  onToggle: (id: LayerId) => void;
  onClose: () => void;
  className?: string;
}) {
  // Collapsing hides the rows only; the legend stays visible (rule 3).
  const [open, setOpen] = useState(true);
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

          {GROUPS.map((group) => {
            const groupRows = rows.filter((r) => r.group === group);
            if (!groupRows.length) return null;
            return (
              <div key={group}>
                <div className="mt-1 border-t border-cc-rule pb-1.5 pt-3 text-sm font-semibold">{group}</div>
                {groupRows.map((r) => (
                  <div key={r.id} className={`flex min-h-10 items-center gap-2.5 py-0.5 ${r.available ? "" : "opacity-60"}`}>
                    <span className="min-w-0 flex-1 text-[13px] leading-tight">
                      {r.label}
                      {r.sub && <span className="block text-xs text-cc-faint">{r.sub}</span>}
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
                      } ${r.available ? "cursor-pointer" : "cursor-not-allowed"}`}
                    >
                      <span aria-hidden="true" className={`absolute top-[2px] h-[15px] w-[15px] rounded-full bg-white shadow-[0_0_0_1px_rgba(22,36,43,0.25)] transition-[left] ${r.on ? "left-[19px]" : "left-[2px]"}`} />
                    </button>
                  </div>
                ))}
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

      <Legend bundle={bundle} layers={layers} className="mt-2 shrink-0 border-t border-cc-rule pt-2.5" />
    </aside>
  );
}

// Always visible: in the column, or as the compact legend on the map.
export function Legend({
  bundle,
  layers,
  compact = false,
  className = "",
}: {
  bundle: CcBundle;
  layers: readonly LayerId[];
  compact?: boolean;
  className?: string;
}) {
  const swatch = "inline-block h-4 w-[22px] shrink-0 rounded-[3px]";
  return (
    <div className={className} data-legend={compact ? "compact" : "full"}>
      <div className={`mb-1.5 font-semibold ${compact ? "text-xs" : "text-sm"}`}>TPI - Risk class</div>
      <div className={`flex flex-col gap-1 ${compact ? "text-xs" : "text-[13px]"}`}>
        {classRows(bundle).map((c) => (
          <span key={c.key} className="inline-flex items-center gap-2.5">
            <span aria-hidden="true" className={swatch} style={{ background: c.color, border: c.key === "low" ? "1px solid #cfcf7a" : undefined }} />
            {c.label} ({c.range})
          </span>
        ))}
        <span className="inline-flex items-center gap-2.5">
          <span aria-hidden="true" className={swatch} style={{ background: HATCH_SWATCH }} />
          Hatched: forecast
        </span>
        {layerLegendRows(bundle, layers).map((r) => (
          <span key={r.id} className="inline-flex items-center gap-2.5">
            <span aria-hidden="true" className={r.round ? "mx-[6px] inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black" : `${swatch} border border-[#9aa7a0]`} style={{ background: r.swatch }} />
            {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}
