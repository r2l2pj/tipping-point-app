// Radar card and before/after pairs. Wording follows the old Radar tab: the
// "NISAR" label needs a real pair, scars are always "candidates".
import { canonicalCaseId } from "@/lib/contract";
import { assetUrl } from "@/lib/layers";
import { hypothesisLine, nisarSeriesView, type NisarSeriesView } from "./nisarSeries";
import { NISAR_FRAMING, nextLookText } from "./nextPass";
import type { NisarPass } from "@/lib/types";
import { availability, hasNisarPair, missingText, NO_RADAR_TEXT } from "./availability";
import { declared } from "./lazy";
import { finite, fmtDate, fmtKm2 } from "./format";
import type { CcBundle } from "./types";

type BBox = [number, number, number, number];

// Landslide scar candidates (lead-analysis): OPERA DIST-ALERT-HLS vegetation
// loss on steep slopes. Candidates, never confirmed.
export const CANDIDATES_LABEL = "Landslide scar candidates (OPERA DIST-ALERT-HLS, vegetation loss)";
export const CANDIDATES_NOTE =
  "Vegetation loss on steep slopes seen by HLS optical — candidates, never confirmed.";

// Figures and context lines of the candidates block: the Now meta
// (dist_meta.json), else the replay metrics scar_*, else the fetched count.
function candidatesBlock(bundle: CcBundle): { value: string; lines: string[] } {
  const people = (n: unknown) => finite(n) ? `${Math.round(n).toLocaleString("en-US")} people (estimate)` : undefined;
  const d = bundle.mode === "live" ? bundle.dist : undefined;
  if (d) {
    return {
      value: d.features.toLocaleString("en-US"),
      lines: [
        [finite(d.km2) ? fmtKm2(d.km2) : undefined, people(d.people)].filter(Boolean).join(" · "),
        d.latest_acquired ? `Newest image ${fmtDate(d.latest_acquired)} — the product is published 1–2 weeks after the pass.` : "",
        d.caveat ? `Caveat: ${d.caveat.charAt(0).toUpperCase()}${d.caveat.slice(1)}.` : "",
      ].filter(Boolean),
    };
  }
  const m = (bundle.metricsView ?? {}) as Record<string, unknown>;
  if (finite(m.scar_candidates_n)) {
    const pct = (v: unknown) => (finite(v) ? `${Math.round(v)}%` : undefined);
    const inv = finite(m.scar_inventory_n) ? m.scar_inventory_n.toLocaleString("en-US") : undefined;
    const hit = pct(m.scar_hit_500m_pct);
    const prec = pct(m.scar_precision_500m_pct);
    return {
      value: m.scar_candidates_n.toLocaleString("en-US"),
      lines: [
        [finite(m.scar_candidates_km2) ? fmtKm2(m.scar_candidates_km2) : undefined, people(m.scar_people)].filter(Boolean).join(" · "),
        hit && inv ? `${hit} of the ${inv} mapped landslides lie within 500 m of a candidate${prec ? `; ${prec} of candidates within 500 m of one` : ""}.` : "",
      ].filter(Boolean),
    };
  }
  const scars = bundle.scars?.features.length;
  return {
    value: scars == null ? missingText(availability(bundle, "landslide_candidates")) : String(scars),
    lines: [],
  };
}
export const AWAITING_PAIR_TEXT = "Awaiting a NISAR pair over the AOI.";
export const GUNW_LIMIT_TEXT =
  "NISAR radar maps flood candidates only in this case; scar candidates come from post-event HLS optical — the GUNW pair spanning the event is a declared limitation.";

export interface CompareSide { url: string; label: string; bounds?: BBox }
export interface ComparePair {
  kind: "radar" | "night-lights";
  bounds: BBox;
  before: CompareSide;
  after: CompareSide;
  // L42: the HV polarization pair (lead-analysis nisar_hv_pre/post); the
  // swipe offers an HH | HV switch only when it exists.
  hv?: { before: CompareSide; after: CompareSide };
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
  word: string,
  // L42a: plain labels ("NISAR radar before — Dec 4, 2025") instead of
  // "pre-event <word> — date".
  plain?: { before: string; after: string }
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
      before: { url: preUrl, label: `${plain?.before ?? `pre-event ${word}`} — ${date(pre, preId)}`, bounds: pre.bounds },
      after: { url: postUrl, label: `${plain?.after ?? `post-event ${word}`} — ${date(post, postId)}`, bounds: post.bounds },
    },
  };
}

export function radarCompare(bundle: CcBundle): CompareOption {
  if (availability(bundle, "radar").state === "not-applicable") return { kind: "radar", reason: NO_RADAR_TEXT };
  const hv = pairFor(bundle, "radar", "nisar_hv_pre", "nisar_hv_post", "NISAR radar",
    { before: "NISAR radar before (HV)", after: "NISAR radar after (HV)" }).pair;
  const hh = pairFor(bundle, "radar", "nisar_pre", "nisar_post", "NISAR radar",
    hv ? { before: "NISAR radar before (HH)", after: "NISAR radar after (HH)" }
      : { before: "NISAR radar before", after: "NISAR radar after" });
  return hh.pair && hv ? { ...hh, pair: { ...hh.pair, hv: { before: hv.before, after: hv.after } } } : hh;
}

export const nightLightsCompare = (bundle: CcBundle): CompareOption =>
  pairFor(bundle, "night-lights", "night_lights_pre", "night_lights_post", "night lights");

// Label of the flood polygons and of the flooded area: follows the pair and
// `flood_source`, never a fixed "NISAR".
export const RESPONSE_AREA_LABEL = "Flooded area (NISAR radar, candidates)";
export const RESPONSE_LAYER_LABEL = "Flooded area (NISAR radar, candidates)";
// Jhonatan (team science): observed water has its own colour — saturated
// cyan fill + white outline above the radar/TPI images; "Flood risk" stays
// the TPI (prediction) only.
export const FLOODED_FILL = "#00d5ff";
export const FLOODED_OUTLINE = "#ffffff";
export const RESPONSE_NOTE =
  "Radar flood candidates from two NISAR passes — not yet checked on the ground.";

const hasDswx = (bundle: CcBundle): boolean =>
  typeof (bundle.products as Record<string, unknown> | undefined)?.flood_dswx === "string";

export function floodLabels(bundle: CcBundle): { area: string; layer: string } {
  // Live case: the response polygons are radar candidates, never "confirmed".
  if (bundle.mode === "live" && (bundle.response || hasDswx(bundle))) {
    return {
      area: RESPONSE_AREA_LABEL,
      layer: hasDswx(bundle) ? "Flooded area (NISAR + OPERA Sentinel-1 radar, candidates)" : RESPONSE_LAYER_LABEL,
    };
  }
  const source = bundle.metricsView?.flood_source;
  if (hasNisarPair(bundle) || source === "nisar") {
    // Radar flood polygons are candidates (never "confirmed"), replay too.
    return { area: "Flooded area (NISAR)", layer: "Flooded area (NISAR radar, candidates)" };
  }
  if (source === "opera") {
    return { area: "Flooded area (optical/OPERA reference)", layer: "Flooded area (OPERA reference)" };
  }
  return { area: "Flooded area (observed reference)", layer: "Flooded area (observed reference)" };
}

export function swathLine(bundle: CcBundle): string | undefined {
  const m = bundle.metricsView as Record<string, unknown> | undefined;
  const coverage = m?.swath_coverage_pct;
  if (m?.flooded_km2_scope !== "within NISAR swath" || !finite(coverage) || !finite(m?.flooded_km2)) {
    return undefined;
  }
  return `within the NISAR swath — ${Math.round(coverage > 1 ? coverage : coverage * 100)}% of the area covered`;
}

// One pass in the shape the card reads. The replay data publishes
// { date, track, note }; the live run publishes { acquired, path, direction,
// granule }. Both are read; a pass without a time is left out.
function toPass(raw: unknown): NisarPass | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const date = text(r.date) ?? text(r.acquired);
  if (!date) return undefined;
  const track = r.track ?? r.path;
  const direction = text(r.direction);
  return {
    date,
    track: typeof track === "string" || finite(track) ? String(track) : "",
    note: text(r.note) ?? (direction ? direction.toLowerCase() : undefined),
  };
}

// Passes over the area, newest first.
export function nisarPasses(bundle: CcBundle): NisarPass[] {
  const dd = bundle.data_dates ?? {};
  const fromDates = Array.isArray(dd.nisar_passes) ? (dd.nisar_passes as unknown[]) : [];
  const raw: unknown[] = fromDates.length ? fromDates : (bundle.nisarPasses ?? []);
  return raw
    .map(toPass)
    .filter((p): p is NisarPass => p !== undefined)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// The card lists the newest passes and counts the rest.
export const PASSES_SHOWN = 5;

export interface RadarCard {
  pair: boolean;
  headline: string; // status line of the card
  dates?: string; // "Dec 4, 2025 → Dec 16, 2025"
  flooded?: { label: string; value: string; swath?: string };
  people?: { label: string; value: string };
  // Live: other satellite flood sources of the R3 summary (OPERA DSWx-S1).
  others?: { label: string; value: string }[];
  note?: string; // live response: candidates + how old the radar pass is
  candidates: { label: string; value: string; note: string; lines?: string[] };
  limitation?: string;
  passes: NisarPass[];
  passCount: number; // all passes, also those not sent to the browser
  canShowOnMap: boolean;
  compare: CompareOption;
  series?: NisarSeriesView; // L42, WA replay
  hypothesisLine?: string; // L42: lead-analysis double-bounce test, when supported
  nextLook?: string; // L43 live: "Next NISAR look: …"
  framing?: string; // L43 live framing line (with nextLook)
}

// Conductor: the live NISAR pass may find nothing (lead-analysis R2 fix can
// publish 0 candidates with a reason) — then the card says so, with the
// dates and the pass list, and never offers an empty map zoom for NISAR.
// lead-analysis R2: nisar_meta.json status — 'candidates' shows polygons;
// 'no_new_flooding' / 'no_usable_pair' show status_label. Without a status:
// 0 km² / 0 polygons = no new flooding; no area, no polygons = not computed.
export interface NisarNoCandidates { label: string; computed: boolean; reason?: string }
export function nisarNoCandidates(bundle: CcBundle): NisarNoCandidates | undefined {
  const r = bundle.response;
  if (bundle.mode !== "live" || !r) return undefined;
  if (r.status) {
    if (r.status === "candidates") return undefined;
    const fresh = r.status === "no_new_flooding";
    return {
      label: r.status_label ?? (fresh ? "No new flooding detected this pass" : "No usable NISAR pair this pass — flood candidates not computed"),
      computed: fresh,
    };
  }
  const r3 = bundle.responseSources?.find((x) => /nisar/i.test(x.source));
  const zero = (v: unknown) => finite(v) && v === 0;
  if (r3 ? zero(r3.flooded_km2) || zero(r3.features) : zero(r.flooded_km2) || zero(r.polygons)) {
    return { label: "No new flooding detected in the latest NISAR pass", computed: true };
  }
  if (!r3 && !finite(r.flooded_km2) && !finite(r.polygons)) {
    const reason = r.null_reasons?.pairs ?? r.null_reasons?.flooded_km2;
    return { label: "No NISAR flood candidates this pass", computed: false, reason };
  }
  return undefined;
}
export const nisarNoFlood = (bundle: CcBundle): boolean => !!nisarNoCandidates(bundle);

// Live case with a published radar response (lead-live R2).
function responseCard(bundle: CcBundle, base: RadarCard): RadarCard {
  const r = bundle.response!;
  const reasonOf = (key: string) => r.null_reasons?.[key];
  // The R3 summary's NISAR figures win when present: the same numbers the
  // public view shows (R3 counts people on one shared grid for all sources).
  const r3 = bundle.responseSources?.find((x) => /nisar/i.test(x.source));
  const value = (key: "flooded_km2" | "people_flooded", fmt: (n: number) => string) => {
    const v = r3 && finite(r3[key]) ? r3[key] : r[key];
    return finite(v)
      ? fmt(v)
      : missingText(reasonOf(key) ? { state: "absent", reason: reasonOf(key) } : { state: "pending" });
  };
  const age = finite(r.latency_h)
    ? ` Newest pair published ${Math.round(r.latency_h)} h after the radar pass.`
    : "";
  const none = nisarNoCandidates(bundle);
  if (none) {
    const pre = r.pre_acquired;
    const post = r.post_acquired;
    // Dates only for a computed pair (the label of a rejected pair says why).
    const dates = none.computed && pre && post && !/\(/.test(none.label) ? ` (${fmtDate(pre)} → ${fmtDate(post)})` : "";
    const reason = none.reason ?? reasonOf("flooded_km2") ?? reasonOf("polygons");
    return {
      ...base,
      // No usable pair (R2: mixed acquisition modes): the rejected pair's
      // images and backscatter series are not shown as evidence.
      ...(none.computed ? {} : { series: undefined, compare: { kind: "radar" as const, reason: "no comparable NISAR pair this pass" } }),
      pair: false,
      headline: `${none.label}${dates}`,
      flooded: { label: RESPONSE_AREA_LABEL, value: none.computed ? "none detected" : "not computed" },
      people: undefined,
      note: reason && !none.label.includes(reason) ? `${reason}.` : undefined,
      limitation: undefined,
      canShowOnMap: false,
    };
  }
  return {
    ...base,
    flooded: { label: RESPONSE_AREA_LABEL, value: value("flooded_km2", fmtKm2) },
    // The published count as is (GPW-based estimate, labelled so), never
    // silently rounded.
    people: {
      label: "People in the flooded area (estimate)",
      value: value("people_flooded", (n) => Math.round(n).toLocaleString("en-US")),
    },
    note: `${RESPONSE_NOTE}${age}`,
    limitation: undefined,
  };
}

export function radarCard(bundle: CcBundle): RadarCard {
  const base = baseRadarCard(bundle);
  const card = bundle.mode === "live" && bundle.response ? responseCard(bundle, base) : base;
  const others = (bundle.mode === "live" ? bundle.responseSources ?? [] : [])
    .filter((s) => !/nisar/i.test(s.source))
    .map((s) => ({
      label: /dswx/i.test(s.source) ? "Also seen by OPERA DSWx-S1 radar (candidates)" : `Also seen by ${s.source} (candidates)`,
      value: `${fmtKm2(s.flooded_km2)}` +
        (finite(s.people_flooded) ? ` · ${Math.round(s.people_flooded).toLocaleString("en-US")} people (estimate)` : "") +
        (s.latest_acquired ? ` · newest pass ${fmtDate(s.latest_acquired)}` : ""),
    }));
  return others.length
    ? { ...card, others, canShowOnMap: card.canShowOnMap || hasDswx(bundle) }
    : card;
}

function baseRadarCard(bundle: CcBundle): RadarCard {
  const dd = bundle.data_dates ?? {};
  const pre = typeof dd.nisar_pre === "string" ? dd.nisar_pre : null;
  const post = typeof dd.nisar_post === "string" ? dd.nisar_post : null;
  const pair = hasNisarPair(bundle);
  const flooded = bundle.metricsView?.flooded_km2;
  const labels = floodLabels(bundle);
  const cand = candidatesBlock(bundle);
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
      value: cand.value,
      note: CANDIDATES_NOTE,
      lines: cand.lines,
    },
    limitation: pair ? GUNW_LIMIT_TEXT : undefined,
    passes: nisarPasses(bundle),
    passCount: Math.max(bundle.nisarPassCount ?? 0, nisarPasses(bundle).length),
    canShowOnMap: bundle.flood
      ? bundle.flood.features.length > 0
      : declared(bundle, "flood_confirmed"),
    compare: radarCompare(bundle),
    series: nisarSeriesView(bundle),
    hypothesisLine: hypothesisLine(bundle),
    nextLook: nextLookText(bundle.nisarNext),
    framing: bundle.nisarNext ? NISAR_FRAMING : undefined,
  };
}
