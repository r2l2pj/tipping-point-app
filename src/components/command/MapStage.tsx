"use client";

import { horizonLabel, probHorizonsAvailable } from "@/lib/layers";

import { useEffect, useMemo, useRef, useState } from "react";
import { Marker, type Map as MapInstance } from "maplibre-gl";
import Map from "../Map";
import { useMapLayers } from "../MapLayers";
import AreaCallout from "./AreaCallout";
import AreaPins from "./AreaPins";
import CompareOverlay, { type CompareControls } from "./CompareOverlay";
import { Legend } from "./LayersColumn";
import LocatorInset from "./LocatorInset";
import MapTools from "./MapTools";
import { pinAreas, type PriorityArea } from "./model/areas";
import { STATUS_WORD, type DataStatus } from "./model/dataStatus";
import { forecastCompare, hasGfsFrames, swipeLeadsFor } from "./model/forecastCompare";
import { layerStateFor, overlaysFor } from "./model/layerRegistry";
import type { ComparePair } from "./model/radar";
import { assetUrl } from "@/lib/layers";
import { caseDirOf } from "./model/lazy";
import { preloadFrames } from "./model/preload";
import { frameFor, issuedFrame, issueLeadsFor, mapCaption, type IssueLead, type Step } from "./model/steps";
import type { CcBundle } from "./model/types";
import type { Action, ScreenState } from "./state";
import type { Insets } from "./useInsets";

// Offsets from the stage edges: the floating cards plus a margin.
const L = (px: number) => `calc(var(--cc-il, 0px) + ${px}px)`;
const R = (px: number) => `calc(var(--cc-ir, 0px) + ${px}px)`;
const B = (px: number) => `calc(var(--cc-ib, 0px) + ${px}px)`;

// A place to frame on request ("View on the map"); `key` makes a repeat
// click on the same alert move the map again.
export interface MapFocus {
  bbox?: [number, number, number, number];
  center?: [number, number];
  key: number;
}

// The searched city (City search): a pin with its name.
export interface CityPin { center: [number, number]; name: string }

export default function MapStage({
  bundle,
  steps,
  state,
  areas,
  status,
  comparePair,
  dispatch,
  onToggleLayers,
  insets,
  stageRef,
  focus,
  featuredCase,
  cityPin,
}: {
  bundle: CcBundle;
  steps: Step[];
  state: ScreenState;
  areas: PriorityArea[];
  status: DataStatus;
  comparePair: ComparePair | undefined;
  dispatch: (a: Action) => void;
  onToggleLayers: () => void;
  insets: Insets; // space covered by the floating cards
  stageRef: React.RefObject<HTMLDivElement | null>;
  featuredCase?: { id: string; short: string };
  focus?: MapFocus;
  cityPin?: CityPin;
}) {
  const [map, setMap] = useState<MapInstance | null>(null);
  const [bearing, setBearing] = useState(0);
  const compare = useRef<CompareControls | null>(null);
  const step = steps[state.dayIndex];

  const layerState = useMemo(
    () => layerStateFor(state.layers, state.hazard),
    [state.layers, state.hazard]
  );
  // Replay "forecast issued this day": the GFS frame issued on the step
  // day for D+k replaces the day's own frame.
  const issued = useMemo(
    () => issuedFrame(bundle, step?.date, state.hazard, state.issueLead)?.layer,
    [bundle, step?.date, state.hazard, state.issueLead]
  );
  const leads = useMemo(() => issueLeadsFor(bundle, step?.date, state.hazard), [bundle, step?.date, state.hazard]);
  // L52 forecast-vs-observed swipe: leads with a full pair for the day.
  const swipeLeads = useMemo(() => swipeLeadsFor(bundle, step?.date, state.hazard), [bundle, step?.date, state.hazard]);
  const gfsAny = useMemo(() => hasGfsFrames(bundle), [bundle]);
  const options = useMemo(
    () => ({
      zoneMarkers: false,
      frameDate: step?.date,
      overlays: overlaysFor(state.layers),
      probHorizon: state.probHorizon,
      frameLayer: issued,
    }),
    [step?.date, state.layers, state.probHorizon, issued]
  );
  useMapLayers(map, bundle, state.dayIndex, layerState, false, undefined, options);

  // Warm the browser cache with the TPI frames of the chosen hazard, so a
  // timeline step swaps an image that is already downloaded.
  useEffect(() => {
    const urls = new Set<string>();
    for (const s of steps) {
      const png = frameFor(bundle, s.date, state.hazard)?.layer.png;
      const url = assetUrl(caseDirOf(bundle), png);
      if (url) urls.add(url);
    }
    return preloadFrames(urls);
  }, [bundle, steps, state.hazard]);

  const pins = useMemo(() => pinAreas(areas), [areas]);
  const selected = areas.find((a) => a.rank === state.selectedArea);

  // Center on the selected area.
  useEffect(() => {
    if (map && selected?.at) {
      map.flyTo({ center: selected.at, zoom: Math.max(map.getZoom(), 11.5), duration: 1200 });
    }
    // Only a new selection moves the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, state.selectedArea, bundle.id]);

  // Frame a requested place. Opening the map view changes the card insets,
  // and the padding ease that follows would cancel a camera move started now:
  // wait for it (300 ms) first.
  // When the case was last fitted (see the padding effect below).
  const fitted = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  // A case switch (city search from Replay) refits the case bounds for
  // 1.5 s: start after that.
  useEffect(() => {
    if (!map || !focus) return;
    // This effect runs before the padding effect: a case not fitted yet is
    // about to be.
    const sinceFit = fitted.current.key !== bundle.id ? 0 : performance.now() - fitted.current.at;
    const t = setTimeout(() => {
      const b = focus.bbox;
      if (b) {
        map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, maxZoom: 12, duration: 1000 });
      } else if (focus.center) {
        map.flyTo({ center: focus.center, zoom: Math.max(map.getZoom(), 11), duration: 1000 });
      }
    }, Math.max(350, 1600 - sinceFit));
    return () => clearTimeout(t);
    // Only a new focus moves the map; the case id is read for timing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focus]);

  useEffect(() => {
    if (!map || !cityPin) return;
    const el = document.createElement("div");
    el.className = "cc-city-pin";
    el.dataset.cityPin = cityPin.name;
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", `Searched city: ${cityPin.name}`);
    const dot = document.createElement("span");
    dot.className = "block h-4 w-4 rounded-full border-[3px] border-white bg-cc-accent shadow-[0_1px_4px_rgba(0,0,0,0.5)]";
    const name = document.createElement("span");
    name.className = "mt-0.5 block whitespace-nowrap rounded bg-white/95 px-1.5 text-xs font-semibold text-cc-ink shadow";
    name.textContent = cityPin.name;
    el.append(dot, name);
    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.alignItems = "center";
    const m = new Marker({ element: el, anchor: "top", offset: [0, -8] }).setLngLat(cityPin.center).addTo(map);
    return () => { m.remove(); };
  }, [map, cityPin]);

  useEffect(() => {
    if (!map) return;
    const onRotate = () => setBearing(map.getBearing());
    map.on("rotate", onRotate);
    return () => {
      map.off("rotate", onRotate);
    };
  }, [map]);

  const fit = (duration = 500) =>
    map?.fitBounds(
      [[bundle.bbox[0], bundle.bbox[1]], [bundle.bbox[2], bundle.bbox[3]]],
      { padding: 60, duration }
    );

  // The camera treats the area under the cards as padding, so "fit" and
  // "center on the area" use the visible part of the map.
  //
  // Any camera call stops a running animation. Map.tsx fits the case bounds
  // with an animation when the map loads and when the case changes; a
  // padding change right after it would cancel that fit and leave the map
  // on its start position. So: on a new map or a new case, and while that
  // fit may still run, the padding is set first and the fit is done again
  // here. Later padding changes only ease the padding.
  useEffect(() => {
    if (!map) return;
    const padding = { left: insets.left, right: insets.right, bottom: insets.bottom, top: 0 };
    const key = bundle.id;
    const fresh = fitted.current.key !== key || performance.now() - fitted.current.at < 1500;
    if (fresh) {
      if (fitted.current.key !== key) fitted.current = { key, at: performance.now() };
      map.setPadding(padding);
      fit(0);
    } else {
      map.easeTo({ padding, duration: 300 });
    }
    // `fit` reads the bundle of this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, bundle.id, insets.left, insets.right, insets.bottom]);
  const comparing = !!comparePair;
  const caption = mapCaption(bundle, steps, state.dayIndex, state.hazard, state.layers, state.issueLead);
  const showLeads = bundle.mode === "replay" && (leads.length > 0 || state.issueLead > 0);
  // Prod regression: the ML forecast horizon must be on the map, not only in
  // the Layers panel (closed on phones).
  const probHorizons = useMemo(() => probHorizonsAvailable(bundle.manifest?.layers), [bundle]);
  // Now + landslide: the chips stay on the map (picking one returns to the ML
  // view even when a forecast day put the TPI on).
  const showHorizons = probHorizons.length > 0 && (state.layers.includes("ptrigger") || (bundle.mode === "live" && state.hazard === "slide"));
  const mlOn = state.layers.includes("ptrigger");
  const chip =
    "rounded-lg bg-white/95 px-2.5 py-1 text-[13px] font-semibold text-cc-ink shadow-[0_2px_8px_rgba(0,0,0,0.3)]";

  return (
    <div
      ref={stageRef}
      className="relative overflow-hidden bg-cc-map max-[899px]:h-[60vh] max-[899px]:min-h-[400px] min-[900px]:absolute min-[900px]:inset-0"
      style={{
        "--cc-il": `${insets.left}px`,
        "--cc-ir": `${insets.right}px`,
        "--cc-ib": `${insets.bottom}px`,
      } as React.CSSProperties}
    >
      <Map bounds={state.fitTo && state.activeId === bundle.id ? state.fitTo : bundle.bbox} onReady={setMap} />
      <AreaPins map={map} areas={pins} selected={state.selectedArea}
        onSelect={(rank) => dispatch({ type: "selectArea", rank })} />
      <AreaCallout
        map={map}
        bundle={bundle}
        area={selected}
        stepDate={step?.date}
        hazard={state.hazard}
        expanded={state.calloutExpanded}
        onToggle={() => dispatch({ type: "toggleCallout" })}
        onClose={() => dispatch({ type: "clearArea" })}
      />

      {/* North arrow: follows the map bearing. */}
      <div aria-hidden="true" className="pointer-events-none absolute top-3 z-10 flex flex-col items-center text-[13px] font-bold text-white [text-shadow:0_1px_3px_#000]" style={{ left: L(14) }}>
        N
        <svg width="20" height="24" viewBox="0 0 20 24" fill="#ffffff" stroke="#16242b" strokeWidth="1" strokeLinejoin="round" style={{ transform: `rotate(${-bearing}deg)` }}>
          <path d="M10 1l7 21-7-5-7 5z" />
        </svg>
      </div>

      <span data-status={status.kind} className={`absolute top-3 z-10 ${chip} !text-xs tracking-[0.02em]`} style={{ left: L(56) }}>
        {STATUS_WORD[status.kind]}
      </span>

      {!comparing && featuredCase && bundle.mode === "live" && (
        <button type="button" data-featured-case onClick={() => dispatch({ type: "goTo", id: featuredCase.id, hazard: "flood" })}
          className={`absolute top-3 z-10 ${chip} !text-xs font-semibold text-cc-accent`} style={{ left: L(140) }}>
          <span className="max-[639px]:hidden">Open the </span>{featuredCase.short}<span className="max-[639px]:hidden"> case</span> →
        </button>
      )}

      {/* Nav (Lucas): one click from any past event back to the live map. */}
      {!comparing && bundle.mode === "replay" && (
        <button type="button" data-back-to-live onClick={() => dispatch({ type: "setMode", mode: "now" })}
          className={`absolute top-3 z-10 ${chip} !text-xs font-semibold text-cc-accent`} style={{ left: L(152) }}>
          ← Back to live<span className="max-[639px]:hidden"> (Now)</span>
        </button>
      )}

      {!comparing && showHorizons && (
        <div role="radiogroup" aria-label="Forecast horizon" data-horizons
          className={`absolute z-10 flex flex-wrap items-center gap-1 ${chip} !py-0.5 max-[639px]:!bottom-auto max-[639px]:top-12 max-[639px]:!left-12`} style={{ left: L(14), bottom: B(70) }}>
          <span className="pr-1 text-xs font-semibold"><span className="max-[639px]:hidden">Landslide likelihood within </span>next:</span>
          {probHorizons.map((h) => (
            <button key={h} type="button" role="radio" aria-checked={mlOn && state.probHorizon === h}
              onClick={() => dispatch({ type: "setProbHorizon", horizon: h })}
              className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${mlOn && state.probHorizon === h ? "bg-cc-accent text-white" : "border border-cc-line-strong"}`}>
              {horizonLabel(h)}
            </button>
          ))}
        </div>
      )}

      {!comparing && showLeads && (
        <div role="group" aria-label="Forecast issued this day" data-issue-leads
          className={`absolute z-10 flex items-center gap-1 ${chip} !py-0.5`} style={{ left: L(14), bottom: B(70) }}>
          <span className="pr-1 text-xs font-semibold">Forecast issued this day:</span>
          {([0, 1, 2, 3] as IssueLead[]).map((k) => (
            <button key={k} type="button" aria-pressed={state.issueLead === k}
              disabled={k > 0 && !leads.includes(k)}
              onClick={() => dispatch({ type: "setIssueLead", lead: k })}
              className={`rounded-md px-1.5 py-0.5 text-xs font-semibold disabled:opacity-40 ${state.issueLead === k ? "bg-cc-accent text-white" : "border border-cc-line-strong"}`}>
              {k === 0 ? "Off" : `+${k} d`}
            </button>
          ))}
        </div>
      )}

      {/* L52: forecast-vs-observed swipe. Offered in Replay when the case
          ships issued GFS frames; disabled (with the reason) on a day with
          no pair. Sits a row above the issue-lead chips. */}
      {!comparing && bundle.mode === "replay" && gfsAny && (
        <button type="button" data-forecast-swipe
          disabled={swipeLeads.length === 0}
          title={swipeLeads.length ? undefined : forecastCompare(bundle, step?.date, state.hazard, state.issueLead).reason}
          onClick={() => dispatch({ type: "openCompare", kind: "forecast" })}
          className={`absolute z-10 ${chip} !py-1 !text-xs disabled:opacity-50`}
          style={{ left: L(14), bottom: B(showLeads ? 104 : 70) }}>
          Forecast vs observed
        </button>
      )}

      {!comparing && (
        <span data-caption className={`absolute z-10 max-w-[46%] ${chip} ${caption.forecast ? "border-2 border-dashed border-cc-forecast-ink" : ""}`} style={{ left: L(14), bottom: B(36) }}>
          {caption.text}
        </span>
      )}

      {!comparing && (
        <div className="absolute z-10 flex items-end gap-2" style={{ right: R(14), bottom: B(12) }}>
          <Legend bundle={bundle} layers={state.layers} hazard={state.hazard} stepDate={step?.date} probHorizon={state.probHorizon} compact
            className={`rounded-[10px] bg-white/95 px-2.5 py-2 text-cc-ink shadow-[0_2px_8px_rgba(0,0,0,0.3)] max-[639px]:hidden ${state.layersOpen ? "min-[900px]:hidden" : ""}`} />
          {/* Phones: the legend is collapsed by default so it does not cover
              the map and the timeline chips; one tap opens it. */}
          <details data-legend-phone className="min-[640px]:hidden rounded-[10px] bg-white/95 text-cc-ink shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
            <summary className="cursor-pointer list-none px-2.5 py-1.5 text-xs font-semibold">Legend</summary>
            <Legend bundle={bundle} layers={state.layers} hazard={state.hazard} stepDate={step?.date} probHorizon={state.probHorizon} compact className="max-h-[50vh] overflow-y-auto px-2.5 pb-2" />
          </details>
          <LocatorInset bbox={bundle.bbox} className="max-[899px]:hidden" />
        </div>
      )}

      {/* L52: the TPI class colours stay readable while the forecast swipe
          is open (both sides paint TPI frames). */}
      {comparePair?.kind === "forecast" && (
        <div className="absolute z-30 flex items-end gap-2" style={{ right: R(14), bottom: B(12) }}>
          <Legend bundle={bundle} layers={["tpi"]} hazard={state.hazard} stepDate={step?.date} probHorizon={state.probHorizon} compact
            className="rounded-[10px] bg-white/95 px-2.5 py-2 text-cc-ink shadow-[0_2px_8px_rgba(0,0,0,0.3)] max-[639px]:hidden" />
          <details data-legend-phone className="min-[640px]:hidden rounded-[10px] bg-white/95 text-cc-ink shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
            <summary className="cursor-pointer list-none px-2.5 py-1.5 text-xs font-semibold">Legend</summary>
            <Legend bundle={bundle} layers={["tpi"]} hazard={state.hazard} stepDate={step?.date} probHorizon={state.probHorizon} compact className="max-h-[50vh] overflow-y-auto px-2.5 pb-2" />
          </details>
        </div>
      )}

      {comparePair && (
        <CompareOverlay key={`${bundle.id}-${comparePair.kind}-${comparePair.before.url}-${comparePair.after.url}`} pair={comparePair} init={state.compareInit}
          forecastCtl={comparePair.kind === "forecast"
            ? { lead: comparePair.lead ?? 0, leads: swipeLeads, onLead: (k) => dispatch({ type: "setIssueLead", lead: k }) }
            : undefined}
          controlsRef={compare} onClose={() => dispatch({ type: "closeCompare" })} />
      )}

      <MapTools
        className="absolute top-3 z-30"
        style={{ right: R(14) }}
        layersShown={state.layersOpen}
        onToggleLayers={onToggleLayers}
        onRecenter={() => (comparing ? compare.current?.recenter() : fit(500))}
        onZoomIn={() => (comparing ? compare.current?.zoomIn() : map?.zoomIn())}
        onZoomOut={() => (comparing ? compare.current?.zoomOut() : map?.zoomOut())}
      />
    </div>
  );
}
