"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapInstance } from "maplibre-gl";
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
import { layerStateFor, overlaysFor } from "./model/layerRegistry";
import type { ComparePair } from "./model/radar";
import { assetUrl } from "@/lib/layers";
import { caseDirOf } from "./model/lazy";
import { preloadFrames } from "./model/preload";
import { frameFor, mapCaption, type Step } from "./model/steps";
import type { CcBundle } from "./model/types";
import type { Action, ScreenState } from "./state";
import type { Insets } from "./useInsets";

// Offsets from the stage edges: the floating cards plus a margin.
const L = (px: number) => `calc(var(--cc-il, 0px) + ${px}px)`;
const R = (px: number) => `calc(var(--cc-ir, 0px) + ${px}px)`;
const B = (px: number) => `calc(var(--cc-ib, 0px) + ${px}px)`;

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
}) {
  const [map, setMap] = useState<MapInstance | null>(null);
  const [bearing, setBearing] = useState(0);
  const compare = useRef<CompareControls | null>(null);
  const step = steps[state.dayIndex];

  const layerState = useMemo(
    () => layerStateFor(state.layers, state.hazard),
    [state.layers, state.hazard]
  );
  const options = useMemo(
    () => ({
      zoneMarkers: false,
      frameDate: step?.date,
      overlays: overlaysFor(state.layers),
      probHorizon: state.probHorizon,
    }),
    [step?.date, state.layers, state.probHorizon]
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
  const fitted = useRef<{ key: string; at: number }>({ key: "", at: 0 });
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
  const caption = mapCaption(bundle, steps, state.dayIndex, state.hazard, state.layers);
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
      <Map bounds={bundle.bbox} onReady={setMap} />
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

      {!comparing && (
        <span data-caption className={`absolute z-10 max-w-[46%] ${chip} ${caption.forecast ? "border-2 border-dashed border-cc-forecast-ink" : ""}`} style={{ left: L(14), bottom: B(36) }}>
          {caption.text}
        </span>
      )}

      {!comparing && (
        <div className="absolute z-10 flex items-end gap-2" style={{ right: R(14), bottom: B(12) }}>
          <Legend bundle={bundle} layers={state.layers} hazard={state.hazard} compact
            className={`rounded-[10px] bg-white/95 px-2.5 py-2 text-cc-ink shadow-[0_2px_8px_rgba(0,0,0,0.3)] ${state.layersOpen ? "min-[900px]:hidden" : ""}`} />
          <LocatorInset bbox={bundle.bbox} className="max-[899px]:hidden" />
        </div>
      )}

      {comparePair && (
        <CompareOverlay key={`${bundle.id}-${comparePair.kind}`} pair={comparePair}
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
