// Screen state of the Command Center: one object, named actions, reset rules
// on a case change. Now / Replay is derived from the active case and the view
// (command / public) from the address; neither is stored here.
import { canonicalCaseId } from "@/lib/contract";
import { probHorizonsAvailable, type ProbHorizon } from "@/lib/layers";
import {
  confirmRadarLayers,
  DEFAULT_LAYERS,
  keepAvailable,
  layerAvailable,
  toggleLayer,
  withRadarDefault,
  type LayerId,
} from "./model/layerRegistry";
import type { ComparePair } from "./model/radar";
import { caseHasHazard, defaultStepIndex, stepsFor } from "./model/steps";
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
  selectedArea: number | null; // zone rank
  calloutExpanded: boolean;
  compareOpen: ComparePair["kind"] | null;
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
  | { type: "escape" };

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

// The screen opens on Now when a live case is loaded, else on the first case.
// `initialCase` (the `?case=<id|alias>` deep link of the old screen) opens
// that case when it is loaded.
export function initialState(
  cases: readonly CcBundle[],
  initialCase?: string,
  initialDay?: number | string // `?day=<offset or date>`
): ScreenState {
  const want = initialCase ? canonicalCaseId(initialCase) : undefined;
  const linked = initialCase
    ? cases.find((c) =>
        c.id === initialCase || canonicalCaseId(c.id) === want ||
        canonicalCaseId(c.manifest?.event ?? c.id) === want)
    : undefined;
  const first = linked ?? cases.find((c) => c.mode === "live") ?? cases[0];
  const hazard = hazardFor(first, "slide");
  return {
    activeId: first?.id ?? "",
    lastReplayId: first?.mode === "replay" ? first.id : null,
    dayIndex: linkedDay(first, initialDay) ?? defaultStepIndex(stepsFor(first)),
    playing: false,
    hazard,
    layers: first ? withRadarDefault(first, keepAvailable(first, DEFAULT_LAYERS, hazard), hazard) : [],
    layerNotice: null,
    probHorizon: probHorizonsAvailable(first?.manifest?.layers)[0] ?? "24h",
    selectedArea: null,
    calloutExpanded: false,
    compareOpen: null,
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
    layers: withRadarDefault(
      bundle,
      kept.length || !layerAvailable(bundle, "tpi", hazard) ? kept : ["tpi"],
      hazard
    ),
    layerNotice: null,
    // The horizon the new case ships first (display order), else the default.
    probHorizon: probHorizonsAvailable(bundle.manifest?.layers)[0] ?? "24h",
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
      return { ...state, hazard: action.hazard };
    }
    case "setProbHorizon":
      return { ...state, probHorizon: action.horizon };
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
