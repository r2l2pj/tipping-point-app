// Radar card and before/after pairs. Wording follows the old Radar tab: the
// "NISAR" label needs a real pair, scars are always "candidates".
import { canonicalCaseId } from "@/lib/contract";
import { assetUrl } from "@/lib/layers";
import type { NisarPass } from "@/lib/types";
import { availability, hasNisarPair, missingText, NO_RADAR_TEXT } from "./availability";
import { declared } from "./lazy";
import { finite, fmtDate, fmtKm2 } from "./format";
import type { CcBundle } from "./types";

type BBox = [number, number, number, number];

export const CANDIDATES_LABEL = "Landslide scar candidates (HLS optical)";
export const CANDIDATES_NOTE =
  "Landslide scar candidates (HLS optical) — candidates, never confirmed.";
export const AWAITING_PAIR_TEXT = "Awaiting a NISAR pair over the AOI.";
export const GUNW_LIMIT_TEXT =
  "NISAR radar confirms floods only in this case; scar candidates come from post-event HLS optical — the GUNW pair spanning the event is a declared limitation.";

export interface ComparePair {
  kind: "radar" | "night-lights";
  bounds: BBox;
  before: { url: string; label: string; bounds?: BBox };
  after: { url: string; label: string; bounds?: BBox };
}

export interface CompareOption {
  kind: ComparePair["kind"];
  pair?: ComparePair;
  reason?: string; // why the control is disabled
}

const unionBounds = (a?: BBox, b?: BBox): BBox | undefined =>
  a && b
    ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
    : (a ?? b);

function pairFor(
  bundle: CcBundle,
  kind: ComparePair["kind"],
  preId: string,
  postId: string,
  word: string
): CompareOption {
  const caseDir = canonicalCaseId(bundle.manifest?.event ?? bundle.id);
  const layers = bundle.manifest?.layers ?? [];
  const pre = layers.find((l) => l.id === preId);
  const post = layers.find((l) => l.id === postId);
  const preUrl = assetUrl(caseDir, pre?.png);
  const postUrl = assetUrl(caseDir, post?.png);
  if (!pre || !post || !preUrl || !postUrl) return { kind, reason: "images not published yet" };
  const dd = bundle.data_dates ?? {};
  const date = (l: { date?: string }, key: string) =>
    fmtDate(l.date ?? (typeof dd[key] === "string" ? (dd[key] as string) : undefined));
  return {
    kind,
    pair: {
      kind,
      bounds: unionBounds(pre.bounds, post.bounds) ?? bundle.bbox,
      before: { url: preUrl, label: `pre-event ${word} — ${date(pre, preId)}`, bounds: pre.bounds },
      after: { url: postUrl, label: `post-event ${word} — ${date(post, postId)}`, bounds: post.bounds },
    },
  };
}

export const radarCompare = (bundle: CcBundle): CompareOption =>
  availability(bundle, "radar").state === "not-applicable"
    ? { kind: "radar", reason: NO_RADAR_TEXT }
    : pairFor(bundle, "radar", "nisar_pre", "nisar_post", "GCOV");

export const nightLightsCompare = (bundle: CcBundle): CompareOption =>
  pairFor(bundle, "night-lights", "night_lights_pre", "night_lights_post", "night lights");

// Label of the flood polygons and of the flooded area: follows the pair and
// `flood_source`, never a fixed "NISAR".
export function floodLabels(bundle: CcBundle): { area: string; layer: string } {
  const source = bundle.metricsView?.flood_source;
  if (hasNisarPair(bundle) || source === "nisar") {
    return { area: "Flooded area (NISAR)", layer: "Flood confirmed by radar (NISAR)" };
  }
  if (source === "opera") {
    return { area: "Flooded area (optical/OPERA reference)", layer: "Flood reference (optical/OPERA)" };
  }
  return { area: "Flooded area (observed reference)", layer: "Flood reference (observed)" };
}

export function swathLine(bundle: CcBundle): string | undefined {
  const m = bundle.metricsView as Record<string, unknown> | undefined;
  const coverage = m?.swath_coverage_pct;
  if (m?.flooded_km2_scope !== "within NISAR swath" || !finite(coverage) || !finite(m?.flooded_km2)) {
    return undefined;
  }
  return `within the NISAR swath — ${Math.round(coverage > 1 ? coverage : coverage * 100)}% of the area covered`;
}

export function nisarPasses(bundle: CcBundle): NisarPass[] {
  const dd = bundle.data_dates ?? {};
  const fromDates = Array.isArray(dd.nisar_passes) ? (dd.nisar_passes as NisarPass[]) : [];
  return fromDates.length ? fromDates : (bundle.nisarPasses ?? []);
}

export interface RadarCard {
  pair: boolean;
  headline: string; // status line of the card
  dates?: string; // "Dec 4, 2025 → Dec 16, 2025"
  flooded?: { label: string; value: string; swath?: string };
  candidates: { label: string; value: string; note: string };
  limitation?: string;
  passes: NisarPass[];
  canShowOnMap: boolean;
  compare: CompareOption;
}

export function radarCard(bundle: CcBundle): RadarCard {
  const dd = bundle.data_dates ?? {};
  const pre = typeof dd.nisar_pre === "string" ? dd.nisar_pre : null;
  const post = typeof dd.nisar_post === "string" ? dd.nisar_post : null;
  const pair = hasNisarPair(bundle);
  const flooded = bundle.metricsView?.flooded_km2;
  const labels = floodLabels(bundle);
  const scars = bundle.scars?.features.length;
  return {
    pair,
    headline: pair
      ? "NISAR pair available"
      : bundle.mode === "live" ? AWAITING_PAIR_TEXT : `${NO_RADAR_TEXT}.`,
    dates: pre && post ? `${fmtDate(pre)} → ${fmtDate(post)}` : undefined,
    flooded: pair || finite(flooded)
      ? {
          label: labels.area,
          value: finite(flooded) ? fmtKm2(flooded) : missingText(availability(bundle, "flooded_km2")),
          swath: swathLine(bundle),
        }
      : undefined,
    candidates: {
      label: CANDIDATES_LABEL,
      value: scars == null ? missingText(availability(bundle, "landslide_candidates")) : String(scars),
      note: CANDIDATES_NOTE,
    },
    limitation: pair ? GUNW_LIMIT_TEXT : undefined,
    passes: nisarPasses(bundle),
    canShowOnMap: bundle.flood
      ? bundle.flood.features.length > 0
      : declared(bundle, "flood_confirmed"),
    compare: radarCompare(bundle),
  };
}
