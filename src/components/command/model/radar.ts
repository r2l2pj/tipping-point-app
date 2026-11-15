// Radar card and before/after pairs. Wording follows the old Radar tab: the
// "NISAR" label needs a real pair, scars are always "candidates".
import { canonicalCaseId } from "@/lib/contract";
import { assetUrl } from "@/lib/layers";
import { hypothesisLine, nisarSeriesView, type NisarSeriesView } from "./nisarSeries";
import { NISAR_FRAMING, nextLookText } from "./nextPass";
import { nisarExtras, type NisarExtra } from "./nisarExtras";
import type { NisarPass } from "@/lib/types";
import { availability, hasNisarPair, missingText, NO_RADAR_TEXT } from "./availability";
import { declared, productUrl } from "./lazy";
import { finite, fmtDate, fmtKm2 } from "./format";
import type { IssueLead } from "./steps";
import type { CcBundle } from "./types";

type BBox = [number, number, number, number];

// Landslide scar candidates (lead-analysis): OPERA DIST-ALERT-HLS vegetation
// loss on steep slopes. Candidates, never confirmed.
export const CANDIDATES_LABEL = "Landslide scar candidates (NASA OPERA land disturbance (DIST), vegetation loss)";
export const CANDIDATES_NOTE =
  "Vegetation loss on steep slopes seen by NASA HLS optical — candidates, never confirmed.";

const scarFigures = (km2: (v: unknown) => string, area: unknown, ppl: string | undefined): string => {
  const parts = [finite(area) ? km2(area) : undefined, ppl].filter(Boolean);
  return parts.length ? `Scar candidates: ${parts.join(", ")}` : "";
};

// WA-size inventories (< 30 points): the 500 m share, for Details only.
export function scarHitDetail(m: Record<string, unknown>): string | undefined {
  if (!finite(m.scar_inventory_n) || m.scar_inventory_n >= 30 || !finite(m.scar_hit_500m_pct)) return undefined;
  return `Scar candidates vs the ${m.scar_inventory_n} mapped landslides: ${Math.round(m.scar_hit_500m_pct)}% within 500 m — too few points to judge.`;
}

// Figures and context lines of the candidates block: the Now meta
// (dist_meta.json), else the replay metrics scar_*, else the fetched count.
function candidatesBlock(bundle: CcBundle): { value: string; lines: string[] } {
  const people = (n: unknown) => finite(n) ? `${Math.round(n).toLocaleString("en-US")} people (estimate)` : undefined;
  const d = bundle.mode === "live" ? bundle.dist : undefined;
  if (d) {
    return {
      value: d.features.toLocaleString("en-US"),
      lines: [
        scarFigures(fmtKm2, d.km2, people(d.people)),
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
        // External review: the figures say what they are.
        scarFigures(fmtKm2, m.scar_candidates_km2, people(m.scar_people)),
        // Under 30 mapped landslides (WA: 15) the share is too thin for the
        // main card: it moves to Details (scarHitDetail).
        hit && inv && finite(m.scar_inventory_n) && m.scar_inventory_n >= 30
          ? `${hit} of the ${inv} mapped landslides lie within 500 m of a candidate${prec ? `; ${prec} of candidates within 500 m of one` : ""}.` : "",
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
  "NISAR radar maps flood candidates only in this case; scar candidates come from post-event NASA HLS optical — the GUNW pair spanning the event is a declared limitation.";

export interface CompareSide { url: string; label: string; bounds?: BBox }
export interface ComparePair {
  kind: "radar" | "night-lights" | "forecast";
  bounds: BBox;
  before: CompareSide;
  after: CompareSide;
  // L52 (forecast swipe): the lead the pair was built for (1–3 days).
  lead?: IssueLead;
  // L42: the HV polarization pair (lead-analysis nisar_hv_pre/post); the
  // swipe offers an HH | HV switch only when it exists.
  hv?: { before: CompareSide; after: CompareSide };
  // Jhonatan: the radar flood polygons over the swipe, in their own colour.
  flood?: { url: string; label: string };
  // Uruguay (L-freeze-1500): NISAR frames on several dates (manifest layers
  // kind 'nisar_frame' {id, date, polarization, png, bounds}) — the swipe
  // picks any two dates, HH or HV.
  stack?: NisarStack;
}
// Conductor blocker: say "NISAR" only for NISAR data. Radar layers carry a
// `sensor` field (lead-analysis); a layer without it keeps the old meaning
// (WA's NISAR pair). Anything else is "Radar" with its sensor note.
export interface RadarSensor { nisar: boolean; name: string; note?: string }
const sensorOf = (l: unknown): string | undefined => {
  const s = (l as Record<string, unknown> | undefined)?.sensor;
  return typeof s === "string" && s.trim() ? s.trim() : undefined;
};
export const sensorName = (s?: string): string => (!s || /^nisar\b/i.test(s) ? "NISAR radar" : "Radar");
export function radarSensor(bundle: CcBundle): RadarSensor {
  const layers = bundle.manifest?.layers ?? [];
  const radarLayers = layers.filter((l) => /^(nisar|radar)_(pre|post|hv_pre|hv_post)$/.test(l.id) ||
    (l as unknown as Record<string, unknown>).kind === "nisar_frame");
  const sensors = radarLayers.map(sensorOf);
  const other = sensors.find((s) => s && !/^nisar\b/i.test(s));
  if (other) return { nisar: false, name: "Radar", note: other };
  // "NISAR (GCOV provisional)": say provisional on the card (L42a: no product code).
  const prov = sensors.find((s) => s && /provisional/i.test(s));
  return { nisar: true, name: "NISAR radar", ...(prov ? { note: "provisional" } : {}) };
}

export const otherGeometry = (l: Record<string, unknown>, role?: string): boolean =>
  (typeof l.png === "string" && /_\d{3}[AD](_[^/]*)?\.png$/i.test(l.png)) ||
  (typeof l.note === "string" && /context track/i.test(l.note)) ||
  (typeof role === "string" && /other geometry|context pass/i.test(role));

export interface NisarStack { dates: string[]; frames: Record<string, { HH?: CompareSide; HV?: CompareSide }>; title: string }

export function nisarStack(bundle: CcBundle): NisarStack | undefined {
  const caseDir = canonicalCaseId(bundle.manifest?.event ?? bundle.id);
  const frames: NisarStack["frames"] = {};
  let allNisar = true;
  // lead-analysis: every NISAR layer carries 'track'; the swipe stays on the
  // main track (the one with the most frames, 010D for Uruguaiana).
  const tracks = (bundle.manifest?.layers ?? []).map((x) => (x as unknown as Record<string, unknown>))
    .filter((x) => x.kind === "nisar_frame" && typeof x.track === "string").map((x) => x.track as string);
  const count = new Map<string, number>();
  for (const t of tracks) count.set(t, (count.get(t) ?? 0) + 1);
  const mainTrack = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  for (const raw of bundle.manifest?.layers ?? []) {
    const l = raw as unknown as Record<string, unknown>;
    if (l.kind !== "nisar_frame" || typeof l.date !== "string" || typeof l.png !== "string") continue;
    const url = assetUrl(caseDir, l.png);
    if (!url) continue;
    const pol = String(l.polarization ?? "HH").toUpperCase() === "HV" ? "HV" : "HH";
    const day = l.date.slice(0, 10);
    // Conductor (Uruguaiana): one viewing geometry per swipe — context passes
    // from other tracks (082D, 060A, 132A) are not compared with the pair track.
    if (mainTrack && typeof l.track === "string" ? l.track !== mainTrack : otherGeometry(l, bundle.nisarSeries?.roles?.[day])) continue;
    const b = Array.isArray(l.bounds) && l.bounds.length === 4 ? (l.bounds as BBox) : undefined;
    const name = sensorName(sensorOf(l));
    if (name !== "NISAR radar") allNisar = false;
    (frames[day] ??= {})[pol] = { url, label: `${name} ${pol} — ${fmtDate(day)}`, bounds: b };
  }
  const dates = Object.keys(frames).filter((d) => frames[d].HH || frames[d].HV).sort();
  return dates.length >= 2 ? { dates, frames, title: allNisar ? "NISAR radar dates" : "Radar dates" } : undefined;
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
  const stack = nisarStack(bundle);
  if (availability(bundle, "radar").state === "not-applicable" && !stack) return { kind: "radar", reason: NO_RADAR_TEXT };
  const n = radarSensor(bundle).name;
  const hv = pairFor(bundle, "radar", "nisar_hv_pre", "nisar_hv_post", n,
    { before: `${n} before (HV)`, after: `${n} after (HV)` }).pair;
  const labels = hv ? { before: `${n} before (HH)`, after: `${n} after (HH)` } : { before: `${n} before`, after: `${n} after` };
  const nisarHh = pairFor(bundle, "radar", "nisar_pre", "nisar_post", n, labels);
  // A non-NISAR pair (lead-analysis radar_pre/radar_post) when no NISAR pair.
  const hh = nisarHh.pair ? nisarHh : (() => {
    const r = pairFor(bundle, "radar", "radar_pre", "radar_post", n, labels);
    return r.pair ? r : nisarHh;
  })();
  let withHv: CompareOption = hh.pair && hv ? { ...hh, pair: { ...hh.pair, hv: { before: hv.before, after: hv.after } } } : hh;
  if (stack) {
    // Frames only (no fixed pair): the swipe starts on the first and last date.
    const side = (d: string) => (stack.frames[d].HH ?? stack.frames[d].HV)!;
    const first = side(stack.dates[0]);
    const last = side(stack.dates[stack.dates.length - 1]);
    const base = withHv.pair ?? { kind: "radar" as const, bounds: unionBounds(first.bounds, last.bounds) ?? bundle.bbox, before: first, after: last };
    withHv = { kind: "radar", pair: { ...base, stack } };
  }
  const floodUrl = productUrl(bundle, "flood_confirmed");
  return withHv.pair && floodUrl
    ? { ...withHv, pair: { ...withHv.pair, flood: { url: floodUrl, label: floodLabels(bundle).layer } } }
    : withHv;
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
      layer: hasDswx(bundle) ? "Flooded area (NISAR + NASA OPERA surface water (DSWx), candidates)" : RESPONSE_LAYER_LABEL,
    };
  }
  const source = bundle.metricsView?.flood_source as string | undefined;
  if (hasNisarPair(bundle) || source === "nisar" || source === "radar") {
    // Radar flood polygons are candidates (never "confirmed"), replay too.
    // "NISAR" only for NISAR data (sensor field).
    return radarSensor(bundle).nisar && source !== "radar"
      ? { area: "Flooded area (NISAR)", layer: "Flooded area (NISAR radar, candidates)" }
      : { area: "Flooded area (radar, candidates)", layer: "Flooded area (radar, candidates)" };
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
  nisar: boolean; // the pair is NISAR data (sensor field)
  headline: string; // status line of the card
  dates?: string; // "Dec 4, 2025 → Dec 16, 2025"
  preIso?: string; // the pair's own pass dates (default of the swipe date chips)
  postIso?: string;
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
  extras: NisarExtra[]; // manifest layers kind 'nisar_extra'
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
      label: /dswx/i.test(s.source) ? "Also seen by NASA OPERA surface water (DSWx) (candidates)" : `Also seen by ${s.source} (candidates)`,
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
  // data_dates first; else the NISAR layers' own dates (Uruguay v0 has none).
  const layerDate = (id: string) => bundle.manifest?.layers?.find((l) => l.id === id || l.id === id.replace(/^nisar_/, "radar_"))?.date ?? null;
  const stack = nisarStack(bundle);
  const pre = typeof dd.nisar_pre === "string" ? dd.nisar_pre : layerDate("nisar_pre") ?? stack?.dates[0] ?? null;
  const post = typeof dd.nisar_post === "string" ? dd.nisar_post : layerDate("nisar_post") ?? stack?.dates[stack.dates.length - 1] ?? null;
  const pair = hasNisarPair(bundle);
  const flooded = bundle.metricsView?.flooded_km2;
  const labels = floodLabels(bundle);
  const cand = candidatesBlock(bundle);
  return {
    pair,
    nisar: radarSensor(bundle).nisar,
    headline: pair
      ? (radarSensor(bundle).nisar
          ? "NISAR radar images available" // conductor (v6): plain headline, no product code
          : `Radar pair available — sensor ${radarSensor(bundle).note}`)
      : bundle.mode === "live" ? AWAITING_PAIR_TEXT : `${NO_RADAR_TEXT}.`,
    dates: pre && post ? `${fmtDate(pre)} → ${fmtDate(post)}` : undefined,
    preIso: pre ? pre.slice(0, 10) : undefined,
    postIso: post ? post.slice(0, 10) : undefined,
    flooded: pair || finite(flooded)
      ? {
          label: labels.area,
          value: finite(flooded) ? fmtKm2(flooded) : missingText(availability(bundle, "flooded_km2")),
          swath: swathLine(bundle),
        }
      : undefined,
    // Replay: people inside the radar flood candidates when published
    // (Uruguay v0: people_flooded, GPW native grid, exact cell fractions).
    people: bundle.mode !== "live" && finite(bundle.metricsView?.people_flooded)
      ? { label: "People in the flooded area (estimate)", value: Math.round(bundle.metricsView!.people_flooded as number).toLocaleString("en-US") }
      : undefined,
    candidates: {
      label: CANDIDATES_LABEL,
      value: cand.value,
      note: CANDIDATES_NOTE,
      lines: cand.lines,
    },
    // WA's declared limitation (GUNW pair) — not for other cases.
    limitation: pair && canonicalCaseId(bundle.manifest?.event ?? bundle.id) === "wa_2025" ? GUNW_LIMIT_TEXT : undefined,
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
    extras: nisarExtras(bundle),
  };
}
