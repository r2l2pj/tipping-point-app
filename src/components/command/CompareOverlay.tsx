"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  Map as MapLibreMap,
  setWorkerUrl,
  type Map as MapInstance,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { boundsToImageCoordinates } from "@/lib/tpi";
import { cameraPatch, clipPathFor, dragStep, pctFromClientX, SWIPE_MAX_PCT, SWIPE_MIN_PCT } from "@/lib/swipe";
import type { ComparePair } from "./model/radar";

// Same worker fix and the same dark basemap as Map.tsx.
setWorkerUrl("/maplibre-gl-worker.js");
const BASEMAP =
  "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json";

export interface CompareControls {
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: () => void;
}

// Before / after comparison over the map container (radar pair or
// night-light pair). Mounted only while it is open: the only time more than
// one map instance exists. Takes over the old SwipeCompare.
export default function CompareOverlay({
  pair,
  onClose,
  controlsRef,
}: {
  pair: ComparePair;
  onClose: () => void;
  controlsRef: MutableRefObject<CompareControls | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const beforeEl = useRef<HTMLDivElement>(null);
  const afterEl = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [pct, setPct] = useState(50);

  useEffect(() => {
    if (!beforeEl.current || !afterEl.current) return;
    const make = (container: HTMLDivElement, attribution: boolean) =>
      new MapLibreMap({
        container,
        style: BASEMAP,
        minZoom: 5,
        maxZoom: 13,
        attributionControl: attribution ? { compact: true } : false,
      });
    const beforeMap = make(beforeEl.current, true);
    const afterMap = make(afterEl.current, false);

    // 'move' listeners are detached while applying a jumpTo so the synced
    // camera does not ping-pong between the pair.
    const sync = (src: MapInstance, dst: MapInstance) => () => {
      off();
      const c = src.getCenter();
      dst.jumpTo(cameraPatch({
        center: [c.lng, c.lat], zoom: src.getZoom(),
        bearing: src.getBearing(), pitch: src.getPitch(),
      }));
      on();
    };
    const beforeToAfter = sync(beforeMap, afterMap);
    const afterToBefore = sync(afterMap, beforeMap);
    function on() {
      beforeMap.on("move", beforeToAfter);
      afterMap.on("move", afterToBefore);
    }
    function off() {
      beforeMap.off("move", beforeToAfter);
      afterMap.off("move", afterToBefore);
    }
    on();

    const fit = (map: MapInstance, duration: number) =>
      map.fitBounds(
        [[pair.bounds[0], pair.bounds[1]], [pair.bounds[2], pair.bounds[3]]],
        { padding: 60, duration }
      );
    let fitted = false;
    const onLoad = (map: MapInstance, side: ComparePair["before"]) => {
      map.addSource("swipe-image", {
        type: "image",
        url: side.url,
        coordinates: boundsToImageCoordinates(side.bounds ?? pair.bounds),
      });
      map.addLayer({ id: "swipe-image", type: "raster", source: "swipe-image" });
      // Only the first map to load fits; its moves sync the other one.
      if (!fitted) {
        fitted = true;
        fit(map, 0);
      }
    };
    beforeMap.on("load", () => onLoad(beforeMap, pair.before));
    afterMap.on("load", () => onLoad(afterMap, pair.after));

    controlsRef.current = {
      zoomIn: () => beforeMap.zoomIn(),
      zoomOut: () => beforeMap.zoomOut(),
      recenter: () => fit(beforeMap, 400),
    };
    return () => {
      controlsRef.current = null;
      beforeMap.remove();
      afterMap.remove();
    };
    // The imagery is fixed for the lifetime of the overlay; a new pair
    // mounts a fresh component (keyed by the caller).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fromPointer = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setPct(pctFromClientX(clientX, rect.left, rect.width));
  };
  const tag = "pointer-events-none absolute top-3 z-10 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-semibold text-cc-ink shadow";

  return (
    <div ref={containerRef} data-compare={pair.kind} className="absolute inset-0 z-20 overflow-hidden bg-cc-map">
      <div ref={beforeEl} className="absolute inset-0" />
      <div ref={afterEl} className="absolute inset-0" style={{ clipPath: clipPathFor(pct) }} />
      <div className={tag} style={{ left: "calc(var(--cc-il, 0px) + 56px)", top: 44 }}>{pair.before.label}</div>
      <div className={tag} style={{ right: "calc(var(--cc-ir, 0px) + 68px)" }}>{pair.after.label}</div>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Divider between the image before the event and the image after it"
        aria-orientation="horizontal"
        aria-valuemin={SWIPE_MIN_PCT}
        aria-valuemax={SWIPE_MAX_PCT}
        aria-valuenow={Math.round(pct)}
        className="absolute inset-y-0 z-20 w-8 -translate-x-1/2 cursor-ew-resize touch-none"
        style={{ left: `${pct}%` }}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) fromPointer(e.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            setPct((p) => dragStep(p, e.key === "ArrowLeft" ? -1 : 1));
            e.preventDefault();
          }
        }}
      >
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cc-ink bg-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16242b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </div>
      </div>
      <button type="button" onClick={onClose}
        style={{ bottom: "calc(var(--cc-ib, 0px) + 12px)" }}
        className="absolute left-1/2 z-30 -translate-x-1/2 rounded-lg bg-white px-3.5 py-2 text-[13px] font-semibold text-cc-ink shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
        Close compare
      </button>
    </div>
  );
}
