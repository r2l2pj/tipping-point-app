// Lucas: an HOUR selector next to the date picker. lead-analysis 6-hourly
// TPI frames (contract: id 'tpi_<hazard>_6h', 'datetime' = end of the 72 h
// rain window in UTC, e.g. "2026-09-30T06:00Z"). Only cases that publish
// them show the hour chips.
import type { ManifestLayer } from "@/lib/types";
import { isGfsFrame } from "@/lib/layers";
import type { CcBundle, Hazard } from "./types";

export const HOURS = ["00", "06", "12", "18"] as const;
const dt = (l: ManifestLayer): string | undefined => {
  const v = (l as unknown as { datetime?: unknown }).datetime;
  return typeof v === "string" ? v : undefined;
};
const sixHourly = (bundle: CcBundle | undefined, hazard: Hazard): ManifestLayer[] =>
  (bundle?.manifest?.layers ?? []).filter((l) => l.id === `tpi_${hazard}_6h` && !isGfsFrame(l) && !!l.png && !!dt(l));

export const hasHourFrames = (bundle: CcBundle | undefined, hazard: Hazard): boolean => sixHourly(bundle, hazard).length > 0;
export function hoursOn(bundle: CcBundle | undefined, hazard: Hazard, date: string | undefined): string[] {
  if (!date) return [];
  return sixHourly(bundle, hazard).map(dt).filter((d): d is string => !!d && d.startsWith(date.slice(0, 10))).map((d) => d.slice(11, 13));
}
export function hourFrameFor(bundle: CcBundle | undefined, hazard: Hazard, date: string | undefined, hour: string | null): ManifestLayer | undefined {
  if (!date || !hour) return undefined;
  return sixHourly(bundle, hazard).find((l) => dt(l)?.startsWith(`${date.slice(0, 10)}T${hour}`));
}
// "Sep 30, 03:00 BRT" (UTC−3) for the caption.
export function hourLabel(l: ManifestLayer): string {
  const d = dt(l);
  if (!d) return "";
  const t = new Date(d.replace(/Z?$/, "Z").replace(/T(\d\d):(\d\d)Z$/, "T$1:$2:00Z"));
  if (Number.isNaN(t.getTime())) return d;
  return t.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " BRT";
}
