"use client";

import type { LayerState } from "./MapLayers";
import type { CaseBundle } from "@/lib/types";
import {
  fmtDataDate,
  layerAvailable,
  type ToggleLayerKey,
} from "@/lib/layers";

interface Row {
  key: keyof LayerState & ToggleLayerKey;
  label: string;
  dateKey?: string;
}

const ROWS: Row[] = [
  { key: "tpiFlood", label: "Flood Risk (TPI)", dateKey: "imerg" },
  { key: "tpiSlide", label: "Landslide Risk (TPI)", dateKey: "imerg" },
  { key: "imerg", label: "IMERG Rain (GPM)", dateKey: "imerg" },
  { key: "smap", label: "Soil Moisture (SMAP)", dateKey: "smap" },
  { key: "nisar", label: "NISAR Change (SAR)", dateKey: "nisar_post" },
];

// Slide and flood TPI share the two-layer budget: enabling one clears the
// other (radio behavior over checkboxes).
const EXCLUSIVE: Partial<Record<keyof LayerState, keyof LayerState>> = {
  tpiFlood: "tpiSlide",
  tpiSlide: "tpiFlood",
};

export default function LayersPanel({
  layers,
  onToggle,
  bundle,
  budget,
  frameDate,
}: {
  layers: LayerState;
  onToggle: (key: keyof LayerState) => void;
  bundle: CaseBundle;
  budget: number;
  frameDate?: string;
}) {
  const dd = bundle.data_dates ?? {};
  // A row only exists when the manifest ships a real raster for the layer —
  // toggles never paint synthetic data as a NASA product.
  const rows = ROWS.filter((r) => layerAvailable(bundle, r.key));
  const handle = (key: keyof LayerState) => {
    const other = EXCLUSIVE[key];
    onToggle(key);
    if (!layers[key] && other && layers[other]) onToggle(other);
  };
  return (
    <div className="absolute left-3 top-3 z-10 w-56 rounded-md border border-zinc-700/60 bg-[#10141c]/90 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300">
        <LayersIcon /> Layers
      </div>
      <ul className="p-2">
        {rows.map((r) => {
          // TPI frames are per-day products — their chip tracks the
          // selected timeline day, not the case data date.
          const isTpi = r.key === "tpiFlood" || r.key === "tpiSlide";
          const raw = isTpi ? frameDate : dd[r.dateKey ?? ""];
          const date = typeof raw === "string" ? fmtDataDate(raw) : null;
          const capped = budget === 0 && !layers[r.key];
          return (
            <li key={r.key}>
              <label
                className={`flex items-start gap-2 rounded px-1.5 py-1.5 ${
                  capped
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:bg-zinc-800/60"
                }`}
                title={
                  capped
                    ? "Max two data layers at once — this tab's overlays use the budget"
                    : undefined
                }
              >
                <input
                  type="checkbox"
                  checked={layers[r.key]}
                  disabled={capped}
                  onChange={() => handle(r.key)}
                  className="mt-0.5 h-3.5 w-3.5 accent-cyan-500"
                />
                <span className="flex-1">
                  <span className="block text-xs text-zinc-200">{r.label}</span>
                  {date && (
                    <span className="block text-xs text-zinc-500">
                      data {date}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-zinc-800 px-3 py-1.5 text-xs leading-snug text-zinc-500">
        Slide and flood TPI are mutually exclusive — max two data layers at
        once, tab overlays included (v3 viz rule).
      </p>
    </div>
  );
}

function LayersIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M8 1.5 14.5 5 8 8.5 1.5 5z" />
      <path d="m1.5 8 6.5 3.5L14.5 8M1.5 11l6.5 3.5L14.5 11" />
    </svg>
  );
}
