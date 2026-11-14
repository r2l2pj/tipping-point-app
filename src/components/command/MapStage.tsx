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
import { mapCaption, type Step } from "./model/steps";
import type { CcBundle } from "./model/types";
import type { Action, ScreenState } from "./state";

export default function MapStage({
  bundle,
  steps,
  state,
  areas,
  status,
  comparePair,
  dispatch,
  onToggleLayers,
}: {
  bundle: CcBundle;
  steps: Step[];
  state: ScreenState;
  areas: PriorityArea[];
  status: DataStatus;
  comparePair: ComparePair | undefined;
  dispatch: (a: Action) => void;
  onToggleLayers: () => void;
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
    }),
    [step?.date, state.layers]
  );
  useMapLayers(map, bundle, state.dayIndex, layerState, false, undefined, options);

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

  const fit = () =>
    map?.fitBounds(
      [[bundle.bbox[0], bundle.bbox[1]], [bundle.bbox[2], bundle.bbox[3]]],
      { padding: 60, duration: 500 }
    );
  const comparing = !!comparePair;
  const caption = mapCaption(bundle, steps, state.dayIndex, state.hazard, state.layers);
  const chip =
    "rounded-lg bg-white/95 px-2.5 py-1 text-[13px] font-semibold text-cc-ink shadow-[0_2px_8px_rgba(0,0,0,0.3)]";

  return (
    <div className="relative min-h-[400px] min-w-0 flex-1 overflow-hidden rounded-xl border border-cc-line-strong bg-cc-map">
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
      <div aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3 z-10 flex flex-col items-center text-[13px] font-bold text-white [text-shadow:0_1px_3px_#000]">
        N
        <svg width="20" height="24" viewBox="0 0 20 24" fill="#ffffff" stroke="#16242b" strokeWidth="1" strokeLinejoin="round" style={{ transform: `rotate(${-bearing}deg)` }}>
          <path d="M10 1l7 21-7-5-7 5z" />
        </svg>
      </div>

      <span data-status={status.kind} className={`absolute left-14 top-3 z-10 ${chip} !text-xs tracking-[0.02em]`}>
        {STATUS_WORD[status.kind]}
      </span>

      {!comparing && (
        <span data-caption className={`absolute bottom-9 left-3.5 z-10 max-w-[62%] ${chip} ${caption.forecast ? "border-2 border-dashed border-cc-forecast-ink" : ""}`}>
          {caption.text}
        </span>
      )}

      {!comparing && (
        <div className={`absolute bottom-3 right-16 z-10 flex items-end gap-2`}>
          <Legend bundle={bundle} layers={state.layers} compact
            className={`rounded-[10px] bg-white/95 px-2.5 py-2 text-cc-ink shadow-[0_2px_8px_rgba(0,0,0,0.3)] ${state.layersOpen ? "min-[900px]:hidden" : ""}`} />
          <LocatorInset bbox={bundle.bbox} className="max-[899px]:hidden" />
        </div>
      )}

      {comparePair && (
        <CompareOverlay key={`${bundle.id}-${comparePair.kind}`} pair={comparePair}
          controlsRef={compare} onClose={() => dispatch({ type: "closeCompare" })} />
      )}

      <MapTools
        className="absolute right-3.5 top-3 z-30"
        layersShown={state.layersOpen}
        onToggleLayers={onToggleLayers}
        onRecenter={() => (comparing ? compare.current?.recenter() : fit())}
        onZoomIn={() => (comparing ? compare.current?.zoomIn() : map?.zoomIn())}
        onZoomOut={() => (comparing ? compare.current?.zoomOut() : map?.zoomOut())}
      />
    </div>
  );
}
