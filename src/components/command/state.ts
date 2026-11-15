import { manifestRaster } from "@/lib/layers";
// Screen state of the Command Center: one object, named actions, reset rules
// on a case change. Now / Replay is derived from the active case and the view
// (command / public) from the address; neither is stored here.
import { canonicalCaseId } from "@/lib/contract";
import { probHorizonsAvailable, type ProbHorizon } from "@/lib/layers";
import {
  confirmRadarLayers,
  DEFAULT_LAYERS,
  defaultLayersFor,
  swapForHazard,
  keepAvailable,
  layerAvailable,
  toggleLayer,
  withRadarDefault,
  type LayerId,
} from "./model/layerRegistry";
import type { ComparePair } from "./model/radar";
import { caseHasHazard, defaultStepIndex, stepsFor, type IssueLead } from "./model/steps";
import type { CcBundle, Hazard } from "./model/types";

export interface ScreenState {
  activeId: string;
  lastReplayId: string | null;
  dayIndex: number;
  playing: boolean;
  hazard: Hazard;
  // Counted data layers that are on, oldest first, at most two. The design
  // calls this `extraLayers`; the TPI index is one of the counted rows.
  layers: LayerId[];
  layerNotice: string | null; // names the layer that was turned off
  probHorizon: ProbHorizon; // P(trigger) horizon painted by the probability layer
  // Opacity of the data rasters over the basemap (OPACITY_MIN to 1). Kept
  // across cases: it is a viewing preference, not case state.
  overlayOpacity: number;
  // Replay: 0 paints the day's own frame; k paints the NOAA GFS forecast
  // issued that day for D+k. Kept while stepping so a demo can walk the
  // issue days at a fixed lead.
  issueLead: IssueLead;
  selectedArea: number | null; // zone rank
  calloutExpanded: boolean;
  compareOpen: ComparePair["kind"] | null;
  compareInit?: { before?: string; after?: string; pol?: "HH" | "HV" }; // deep link, first open only
  fitTo?: [number, number, number, number]; // deep link ?fit=<layer>: initial map bounds
  detailsOpen: boolean;
  layersOpen: boolean;
  listExpanded: boolean;
  chartAsTable: boolean;
}

export type Action =
  | { type: "selectCase"; id: string }
  | { type: "setMode"; mode: "now" | "replay" }
  | { type: "seek"; index: number }
  | { type: "prev" }
  | { type: "next" }
  | { type: "togglePlay" }
  | { type: "tick" }
  | { type: "setHazard"; hazard: Hazard }
  | { type: "setProbHorizon"; horizon: ProbHorizon }
  | { type: "setOpacity"; value: number }
  | { type: "setIssueLead"; lead: IssueLead }
  | { type: "toggleLayer"; id: LayerId }
  | { type: "confirmRadar" }
  | { type: "selectArea"; rank: number }
  | { type: "clearArea" }
  | { type: "toggleCallout" }
  | { type: "openCompare"; kind: ComparePair["kind"] }
  | { type: "closeCompare" }
  | { type: "toggleDetails" }
  | { type: "toggleLayersOpen" }
  | { type: "toggleList" }
  | { type: "toggleTable" }
  | { type: "escape" }
  // "Start here" (judge report #6): one stop of the guided tour.
  | { type: "goTo"; id: string; day?: number | string; hazard?: Hazard; lead?: IssueLead; layer?: LayerId; compare?: ComparePair["kind"] };

// The data rasters open see-through, so rivers, coast and relief of the
// basemap stay readable under them; the Layers column has the control.
export const OPACITY_DEFAULT = 0.65;
export const OPACITY_MIN = 0.2;

const find = (cases: readonly CcBundle[], id: string) => cases.find((c) => c.id === id);

// Hazard a case opens on: the hazard most of its priority zones name (from
// the data), when the case has that raster. A flood event must not open on
// the landslide raster: its red slopes read as an "inverted" flood map.
// Without zones the current choice is kept.
export function caseHazard(bundle: CcBundle | undefined): Hazard | undefined {
  const count = { slide: 0, flood: 0 };
  for (const f of bundle?.zones?.features ?? []) {
    const h = String(f.properties?.hazard ?? "").toLowerCase();
    if (h.includes("flood")) count.flood += 1;
    else if (h.includes("slide")) count.slide += 1;
  }
  if (count.flood === count.slide) return undefined;
  const top: Hazard = count.flood > count.slide ? "flood" : "slide";
  return bundle && caseHasHazard(bundle, top) ? top : undefined;
}

const hazardFor = (bundle: CcBundle | undefined, kept: Hazard): Hazard => {
  // L48: in Now the ML landslide likelihood is the primary view when published.
  if (bundle?.mode === "live" && layerAvailable(bundle, "ptrigger", "slide")) return "slide";
  const current = caseHazard(bundle) ?? kept;
  if (!bundle || caseHasHazard(bundle, current)) return current;
  const other: Hazard = current === "slide" ? "flood" : "slide";
  return caseHasHazard(bundle, other) ? other : current;
};

// `?day=` of a link: a day offset from the event day ("-4", "3") or a
// calendar date ("2025-12-08"). Any other value opens the default step.
const linkedDay = (bundle: CcBundle | undefined, link?: number | string): number | undefined => {
  if (link === undefined || link === "") return undefined;
  const steps = stepsFor(bundle);
  const text = String(link).trim();
  const i = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? steps.findIndex((s) => s.date.slice(0, 10) === text)
    : /^[+-]?\d+$/.test(text)
      ? steps.findIndex((s) => s.offset === Number(text))
      : -1;
  return i >= 0 ? i : undefined;
};

// Case and step of the address. Now has no parameters; a replay names its
// case, and its step when that is not the step the case opens on.
export function linkParams(
  bundle: CcBundle | undefined,
  dayIndex: number
): { case?: string; day?: string } {
  if (!bundle || bundle.mode !== "replay") return {};
  const steps = stepsFor(bundle);
  const offset = steps[dayIndex]?.offset;
  return {
    case: canonicalCaseId(bundle.id),
    day: dayIndex !== defaultStepIndex(steps) && offset !== undefined ? String(offset) : undefined,
  };
}

// Lucas (2026-11-15): the Uruguay River flood is the main case — when it is
// loaded it is listed first and the screen opens on it (a ?case= link still
// wins). Without it: Now when a live case is loaded, else the first case.
export const FEATURED_CASE = "rs_uruguai_2026";
export const isFeatured = (c: CcBundle): boolean =>
  canonicalCaseId(c.manifest?.event ?? c.id) === FEATURED_CASE || canonicalCaseId(c.id) === FEATURED_CASE;
export function featuredFirst<T extends CcBundle>(cases: readonly T[]): T[] {
  return [...cases.filter(isFeatured), ...cases.filter((c) => !isFeatured(c))];
}

// The screen opens on Now when a live case is loaded, else on the first case.
// `initialCase` (the `?case=<id|alias>` deep link of the old screen) opens
// that case when it is loaded.
export interface DeepLink { lead?: string; compare?: string; before?: string; after?: string; pol?: string; layers?: string; fit?: string }

// ?layers=imerg,hand5 → layer ids ("hand5"/"hand" = low ground); ?fit=<key>
// → the map opens on that layer's bounds (the upstream basin for imerg).
const LINK_LAYER: Record<string, LayerId> = { imerg: "imerg", rain: "imerg", hand: "hand", hand5: "hand", tpi: "tpi", flood: "flood", ml: "ptrigger", ptrigger: "ptrigger", smap: "smap" };
const LINK_FIT: Record<string, "imerg" | "hand"> = { imerg: "imerg", rain: "imerg", hand: "hand", hand5: "hand" };
function linkLayers(bundle: CcBundle, link: DeepLink, hazard: Hazard): LayerId[] | undefined {
  if (!link.layers) return undefined;
  const ids = link.layers.split(",").map((x) => LINK_LAYER[x.trim().toLowerCase()]).filter((x): x is LayerId => !!x);
  const ok = keepAvailable(bundle, [...new Set(ids)], hazard);
  return ok.length ? ok : undefined;
}
function linkFit(bundle: CcBundle, link: DeepLink): [number, number, number, number] | undefined {
  const key = link.fit ? LINK_FIT[link.fit.trim().toLowerCase()] : undefined;
  const b = key ? manifestRaster(bundle.manifest?.layers, key)?.bounds : undefined;
  return Array.isArray(b) && b.length === 4 ? (b as [number, number, number, number]) : undefined;
}

export function initialState(
  cases: readonly CcBundle[],
  initialCase?: string,
  initialDay?: number | string, // `?day=<offset or date>`
  // Recording deep links: ?lead=1..3 (forecast issued N days ahead),
  // ?compare=radar, ?before=/?after=YYYY-MM-DD and ?pol=HH|HV for the swipe.
  link: DeepLink = {}
): ScreenState {
  const want = initialCase ? canonicalCaseId(initialCase) : undefined;
  const linked = initialCase
    ? cases.find((c) =>
        c.id === initialCase || canonicalCaseId(c.id) === want ||
        canonicalCaseId(c.manifest?.event ?? c.id) === want)
    : undefined;
  // Prod regression (Lucas): '/' opens the live Now forecast; the featured
  // Uruguay case stays first in the Replay list and the tour (and its own
  // ?case= link / map chip).
  const first = linked ?? cases.find((c) => c.mode === "live") ?? cases.find(isFeatured) ?? cases[0];
  const hazard = hazardFor(first, "slide");
  return {
    activeId: first?.id ?? "",
    lastReplayId: first?.mode === "replay" ? first.id : null,
    dayIndex: linkedDay(first, initialDay) ?? defaultStepIndex(stepsFor(first)),
    playing: false,
    hazard,
    layers: first
      ? (linkLayers(first, link, hazard) ?? withRadarDefault(first, keepAvailable(first, Number(link.lead) > 0 ? ["tpi"] : defaultLayersFor(first, hazard), hazard), hazard))
      : [],
    fitTo: first ? linkFit(first, link) : undefined,
    layerNotice: null,
    probHorizon: probHorizonsAvailable(first?.manifest?.layers)[0] ?? "24h",
    overlayOpacity: OPACITY_DEFAULT,
    issueLead: [1, 2, 3].includes(Number(link.lead)) && first && layerAvailable(first, "tpi", hazard) ? Number(link.lead) as 1 | 2 | 3 : 0,
    selectedArea: null,
    calloutExpanded: false,
    compareOpen: link.compare === "radar" ? "radar" : null,
    compareInit: { before: link.before, after: link.after, pol: link.pol === "HV" ? "HV" : link.pol === "HH" ? "HH" : undefined },
    detailsOpen: false,
    layersOpen: true,
    listExpanded: false,
    chartAsTable: false,
  };
}

function selectCase(state: ScreenState, cases: readonly CcBundle[], id: string): ScreenState {
  const bundle = find(cases, id);
  if (!bundle || id === state.activeId) return state;
  const hazard = hazardFor(bundle, state.hazard);
  const kept = keepAvailable(bundle, state.layers, hazard);
  return {
    ...state,
    activeId: id,
    lastReplayId: bundle.mode === "replay" ? id : state.lastReplayId,
    dayIndex: defaultStepIndex(stepsFor(bundle)),
    playing: false,
    hazard,
    // The TPI index is the default layer: a case change never leaves the
    // map without it when the new case has the raster.
    // Now with a NISAR pair adds the radar flood candidates (L27).
    // The TPI index is the default layer: a case change always brings it
    // back when the new case has the raster (arriving from a paused Now
    // with only the flood candidates on must not open a replay without it).
    layers: withRadarDefault(
      bundle,
      !layerAvailable(bundle, "tpi", hazard) || kept.includes("tpi") ? kept : toggleLayer(kept, "tpi").layers,
      hazard
    ),
    layerNotice: null,
    // The horizon the new case ships first (display order), else the default.
    probHorizon: probHorizonsAvailable(bundle.manifest?.layers)[0] ?? "24h",
    issueLead: 0,
    selectedArea: null,
    calloutExpanded: false,
    compareOpen: null,
    detailsOpen: false,
  };
}

export function reduce(
  state: ScreenState,
  action: Action,
  cases: readonly CcBundle[]
): ScreenState {
  if (action.type === "goTo") {
    const target = find(cases, action.id);
    if (!target) return state;
    let next = reduce({ ...state, compareOpen: null, selectedArea: null }, { type: "selectCase", id: action.id }, cases);
    // Each stop starts from the case's own opening layers, not the last stop's.
    const hazard = action.hazard && caseHasHazard(target, action.hazard) ? action.hazard : next.hazard;
    next = { ...next, hazard, layers: withRadarDefault(target, keepAvailable(target, defaultLayersFor(target, hazard), hazard), hazard), layerNotice: null };
    const day = linkedDay(target, action.day) ?? defaultStepIndex(stepsFor(target));
    next = reduce(next, { type: "seek", index: day }, cases);
    next = reduce(next, { type: "setIssueLead", lead: action.lead ?? 0 }, cases);
    if (action.layer && !next.layers.includes(action.layer) && layerAvailable(target, action.layer, next.hazard)) {
      next = reduce(next, { type: "toggleLayer", id: action.layer }, cases);
    }
    if (action.compare) next = reduce(next, { type: "openCompare", kind: action.compare }, cases);
    return next;
  }
  const bundle = find(cases, state.activeId);
  const last = Math.max(0, stepsFor(bundle).length - 1);
  // A manual step pauses playback.
  const manualSeek = (index: number): ScreenState => ({
    ...state,
    dayIndex: Math.min(last, Math.max(0, index)),
    playing: false,
  });

  switch (action.type) {
    case "selectCase":
      return selectCase(state, cases, action.id);
    case "setMode": {
      if (action.mode === "now") {
        const live = cases.find((c) => c.mode === "live");
        return live ? selectCase(state, cases, live.id) : state;
      }
      const replay =
        cases.find((c) => c.id === state.lastReplayId && c.mode === "replay") ??
        cases.find((c) => c.mode === "replay");
      return replay ? selectCase(state, cases, replay.id) : state;
    }
    case "seek":
      return manualSeek(action.index);
    case "prev":
      return manualSeek(state.dayIndex - 1);
    case "next":
      return manualSeek(state.dayIndex + 1);
    case "togglePlay":
      if (state.playing) return { ...state, playing: false };
      if (last < 1) return state;
      // Play from the last step starts again at the first one.
      return { ...state, playing: true, dayIndex: state.dayIndex >= last ? 0 : state.dayIndex };
    case "tick": {
      if (!state.playing) return state;
      const dayIndex = Math.min(last, state.dayIndex + 1);
      return { ...state, dayIndex, playing: dayIndex < last };
    }
    case "setHazard": {
      if (!bundle || action.hazard === state.hazard) return state;
      return { ...state, hazard: action.hazard, layers: swapForHazard(bundle, state.layers, action.hazard) };
    }
    case "setProbHorizon":
      return { ...state, probHorizon: action.horizon };
    case "setOpacity":
      return Number.isFinite(action.value)
        ? { ...state, overlayOpacity: Math.min(1, Math.max(OPACITY_MIN, action.value)) }
        : state;
    case "setIssueLead": {
      // A forecast lead needs the TPI index on the map.
      const tpiOn = state.layers.includes("tpi");
      const canTpi = !!bundle && layerAvailable(bundle, "tpi", state.hazard);
      const layers = action.lead > 0 && !tpiOn && canTpi ? toggleLayer(state.layers, "tpi").layers : state.layers;
      return { ...state, issueLead: action.lead, layers };
    }
    case "toggleLayer": {
      if (!bundle) return state;
      if (!state.layers.includes(action.id) && !layerAvailable(bundle, action.id, state.hazard)) {
        return state; // a row without data cannot be turned on
      }
      const result = toggleLayer(state.layers, action.id);
      return { ...state, layers: result.layers, layerNotice: result.notice ?? null };
    }
    case "confirmRadar": {
      if (!bundle || !layerAvailable(bundle, "flood", state.hazard)) return state;
      const result = confirmRadarLayers(state.layers);
      return {
        ...state,
        layers: keepAvailable(bundle, result.layers, state.hazard),
        layerNotice: result.notice ?? null,
      };
    }
    case "selectArea":
      // The same row or pin again clears the selection. Selecting pauses.
      return state.selectedArea === action.rank
        ? { ...state, selectedArea: null, calloutExpanded: false }
        : { ...state, selectedArea: action.rank, calloutExpanded: false, playing: false };
    case "clearArea":
      return { ...state, selectedArea: null, calloutExpanded: false };
    case "toggleCallout":
      return state.selectedArea === null
        ? state : { ...state, calloutExpanded: !state.calloutExpanded };
    case "openCompare":
      // Opening the comparison keeps the layers; closing restores the map.
      return { ...state, compareOpen: action.kind, playing: false };
    case "closeCompare":
      return { ...state, compareOpen: null };
    case "toggleDetails":
      return { ...state, detailsOpen: !state.detailsOpen };
    case "toggleLayersOpen":
      return { ...state, layersOpen: !state.layersOpen };
    case "toggleList":
      return { ...state, listExpanded: !state.listExpanded };
    case "toggleTable":
      return { ...state, chartAsTable: !state.chartAsTable };
    case "escape":
      if (state.compareOpen) return { ...state, compareOpen: null };
      return state.selectedArea === null
        ? state : { ...state, selectedArea: null, calloutExpanded: false };
  }
}

export const PLAYBACK_MS = 1200;
