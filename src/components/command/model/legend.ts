// Legend rows: TPI classes with the cuts of the case, and one row per data
// layer that is on. Class colors and opacities stay in src/lib/tpi.ts.
import { OPERA } from "@/lib/layers";
import { cutsFor, TPI_CLASSES } from "@/lib/tpi";
import type { LayerId } from "./layerRegistry";
import { CANDIDATES_LABEL, floodLabels } from "./radar";
import type { CcBundle } from "./types";

export interface ClassRow {
  key: string;
  label: string;
  color: string;
  range: string;
}

// Upper class: "0.60 or more". A value equal to a cut belongs to the upper
// class, as tpiClass() decides; the legend says the same.
export function classRows(bundle: CcBundle | undefined): ClassRow[] {
  const edges = [0, ...cutsFor(bundle), 1];
  return TPI_CLASSES.map((c, i) => ({
    key: c.key,
    label: c.label,
    color: c.color,
    range: i === TPI_CLASSES.length - 1
      ? `${edges[i].toFixed(2)} or more`
      : `${edges[i].toFixed(2)} to below ${edges[i + 1].toFixed(2)}`,
  }));
}

export const CLASS_COLOR: Record<string, string> = Object.fromEntries(
  TPI_CLASSES.map((c) => [c.label, c.color])
);

export interface LayerLegendRow {
  id: string;
  label: string;
  swatch: string; // CSS background
  round?: boolean;
}

export function layerLegendRows(bundle: CcBundle, on: readonly LayerId[]): LayerLegendRow[] {
  const rows: LayerLegendRow[] = [];
  if (on.includes("imerg")) rows.push({ id: "imerg", label: "Rain (GPM IMERG)", swatch: "linear-gradient(90deg, #e6f1fb, #2166ac)" });
  if (on.includes("smap")) rows.push({ id: "smap", label: "Soil moisture (SMAP), 0 to 1", swatch: "linear-gradient(90deg, #f6e8c3, #8c510a)" });
  if (on.includes("ptrigger")) rows.push({ id: "ptrigger", label: "Relative likelihood, low → high (not a percentage)", swatch: "linear-gradient(90deg, #f2f0f7, #54278f)" });
  if (on.includes("tml")) rows.push({ id: "tml", label: "Modeled landslide hazard, 0 to 1", swatch: "linear-gradient(90deg, #ffffb2, #bd0026)" });
  if (on.includes("flood")) rows.push({ id: "flood", label: floodLabels(bundle).layer, swatch: "#2166ac" });
  if (on.includes("candidates")) rows.push({ id: "candidates", label: CANDIDATES_LABEL, swatch: "#7b3294" });
  if (on.includes("catalog")) rows.push({ id: "catalog", label: "Landslide catalog point", swatch: "#ffffff", round: true });
  if (on.includes("ems")) rows.push({ id: "ems", label: "Copernicus EMS flood map (© European Union, Copernicus EMS)", swatch: "#00e5ff" });
  if (on.includes("opera")) {
    rows.push(
      { id: "opera-both", label: "New flood in both NISAR and OPERA", swatch: OPERA.both },
      { id: "opera-nisar", label: "NISAR only", swatch: OPERA.nisarOnly },
      { id: "opera-opera", label: "OPERA DSWx-S1 only", swatch: OPERA.operaOnly },
    );
  }
  return rows;
}

export const HATCH_SWATCH =
  "repeating-linear-gradient(45deg, #fd8d3c 0 3px, #ffe3cc 3px 6px)";
