// "More NISAR products" (conductor, approved before the freeze): any manifest
// layer with kind 'nisar_extra' — {id, label, png, bounds, date, legend:
// [{label, color}], attribution, note} — shows in the radar card as an image
// with its legend and attribution. PNG only (no map toggle); hidden if none.
import { canonicalCaseId } from "@/lib/contract";
import { assetUrl, fmtDate } from "@/lib/layers";
import type { CcBundle } from "./types";
import { plainText } from "./plain";

type M = Record<string, unknown>;
const isRecord = (v: unknown): v is M => typeof v === "object" && v !== null && !Array.isArray(v);

export interface NisarExtra {
  id: string;
  label: string;
  url: string;
  date?: string;
  legend: { label: string; color: string }[];
  attribution?: string;
  note?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function nisarExtras(bundle: CcBundle): NisarExtra[] {
  const caseDir = canonicalCaseId(bundle.manifest?.event ?? bundle.id);
  return (bundle.manifest?.layers ?? []).flatMap((raw) => {
    const l = raw as unknown as M;
    // Conductor (Uruguaiana): the 010D change maps (lead-analysis kind
    // 'nisar_change') show here too — HH only; HV is one tap away in the swipe.
    const change = l.kind === "nisar_change";
    if ((l.kind !== "nisar_extra" && !change) || typeof l.png !== "string" || typeof l.id !== "string") return [];
    if (change && /_hv_/i.test(l.id)) return [];
    const url = assetUrl(caseDir, l.png);
    if (!url) return [];
    const legend = Array.isArray(l.legend)
      ? l.legend.filter((x): x is M => isRecord(x) && typeof x.label === "string" && typeof x.color === "string")
          .map((x) => ({ label: x.label as string, color: x.color as string }))
      : [];
    return [{
      id: l.id,
      label: plainText(typeof l.label === "string" ? l.label : l.id.replace(/_/g, " "))
        .replace(/→ (\d{2})-(\d{2})\)/, (_m, mm: string, dd: string) => `→ ${MONTHS[Number(mm) - 1] ?? mm} ${Number(dd)})`),
      url,
      date: typeof l.date === "string" ? fmtDate(l.date) : undefined,
      legend,
      attribution: typeof l.attribution === "string" ? l.attribution : undefined,
      note: typeof l.note === "string" ? plainText(l.note) : undefined,
    }];
  });
}
