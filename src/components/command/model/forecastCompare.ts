// L52 U2 — the "Forecast vs observed" swipe. For a timeline day D and a
// lead k (1–3 d): left = the NOAA GFS TPI frame issued D−k depicting D,
// right = the observed TPI frame on D. Pure: the button, the lead chips
// and the overlay all read this result; no pair means a short reason.
import { assetUrl, isGfsFrame } from "@/lib/layers";
import type { ManifestLayer } from "@/lib/types";
import { fmtDate } from "./format";
import { caseDirOf } from "./lazy";
import type { CompareOption } from "./radar";
import { ISSUE_LEADS, issuedFrame, type Frame, type IssueLead } from "./steps";
import type { CcBundle, Hazard } from "./types";

type BBox = [number, number, number, number];

// Side tags (fixed wording of the brief).
export const forecastSideLabel = (issued: string | undefined): string =>
  `Forecast (NOAA GFS, issued ${fmtDate(issued)})`;
export const observedSideLabel = (day: string): string =>
  `Observed (NASA IMERG + SMAP) — ${fmtDate(day)}`;

const DAY_MS = 86_400_000;
// Calendar-date arithmetic; the input may carry a time part.
const shiftDay = (iso: string, days: number): string =>
  new Date(new Date(`${iso.slice(0, 10)}T12:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

const unionBounds = (a?: BBox, b?: BBox): BBox | undefined =>
  a && b
    ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
    : (a ?? b);

// The case ships at least one issued-forecast frame: the swipe can be
// offered (a day still needs its own pair).
export const hasGfsFrames = (bundle: CcBundle): boolean =>
  (bundle.manifest?.layers ?? []).some((l) => isGfsFrame(l) && !!l.png);

// The observed frame of a day: a non-GFS TPI frame of the hazard painted
// for the date. The plain frame wins; a perfect-forecast upper bound is
// copied observation, so it can stand in when nothing else depicts the day.
function observedFrame(
  bundle: CcBundle,
  date: string,
  hazard: Hazard
): ManifestLayer | undefined {
  const day = date.slice(0, 10);
  const cand = (bundle.manifest?.layers ?? []).filter(
    (l) =>
      !!l.png &&
      l.date?.slice(0, 10) === day &&
      l.id.startsWith(`tpi_${hazard}`) &&
      !isGfsFrame(l)
  );
  return (
    cand.find((l) => l.id === `tpi_${hazard}`) ??
    cand.find((l) => !l.upper_bound) ??
    cand[0]
  );
}

// The GFS frame for day D issued k days before — the run of issue day D−k
// depicts D. A frame whose published depicted date is not D does not count.
export function forecastFrameFor(
  bundle: CcBundle,
  day: string | undefined,
  hazard: Hazard,
  k: IssueLead
): Frame | undefined {
  if (!day || k === 0) return undefined;
  const f = issuedFrame(bundle, shiftDay(day, -k), hazard, k);
  const depicted = f?.layer.date?.slice(0, 10);
  return f && (depicted === undefined || depicted === day.slice(0, 10)) ? f : undefined;
}

// Leads with a full pair for the day (forecast frame issued D−k and an
// observed frame on D): the swipe chips disable the rest.
export const swipeLeadsFor = (
  bundle: CcBundle,
  day: string | undefined,
  hazard: Hazard
): IssueLead[] =>
  !day
    ? []
    : ISSUE_LEADS.filter(
        (k) => !!forecastFrameFor(bundle, day, hazard, k) && !!observedFrame(bundle, day, hazard)
      );

export function forecastCompare(
  bundle: CcBundle,
  stepDate: string | undefined,
  hazard: Hazard,
  lead: IssueLead
): CompareOption {
  const kind = "forecast" as const;
  const day = stepDate?.slice(0, 10);
  if (!day) return { kind, reason: "Pick a day on the timeline" };
  const obs = observedFrame(bundle, day, hazard);
  // Lead 0 (the deep link without ?lead=, or a fresh open) picks the first
  // lead with a pair; a requested lead the day does not have falls back the
  // same way so a timeline seek never closes the swipe. The chips disable
  // missing leads and name the pair's own lead.
  const leads = swipeLeadsFor(bundle, day, hazard);
  const k = lead !== 0 && leads.includes(lead) ? lead : leads[0];
  if (!k) {
    return {
      kind,
      reason: !obs
        ? `No observed TPI frame for ${fmtDate(day)}`
        : lead !== 0
          ? `No NOAA GFS forecast issued ${fmtDate(shiftDay(day, -lead))} for ${fmtDate(day)}`
          : `No NOAA GFS forecast for ${fmtDate(day)}`,
    };
  }
  const issued = shiftDay(day, -k);
  const fc = forecastFrameFor(bundle, day, hazard, k)!;
  if (!obs) return { kind, reason: `No observed TPI frame for ${fmtDate(day)}` };
  const dir = caseDirOf(bundle);
  const before = assetUrl(dir, fc.layer.png);
  const after = assetUrl(dir, obs.png);
  if (!before || !after) return { kind, reason: "images not published yet" };
  return {
    kind,
    pair: {
      kind,
      lead: k,
      bounds: unionBounds(fc.layer.bounds, obs.bounds) ?? bundle.bbox,
      before: {
        url: before,
        label: forecastSideLabel(fc.layer.issued ?? issued),
        bounds: fc.layer.bounds,
      },
      after: { url: after, label: observedSideLabel(day), bounds: obs.bounds },
    },
  };
}
