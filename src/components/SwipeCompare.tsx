"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  setWorkerUrl,
  type Map as MapInstance,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cameraPatch, clipPathFor, dragStep, pctFromClientX } from "@/lib/swipe";

// Same worker fix as Map.tsx: Turbopack can't resolve maplibre-gl v6's default
// worker import; the bundle is copied to public/ and wired up explicitly.
setWorkerUrl("/maplibre-gl-worker.js");

// Same dark CARTO no-labels basemap as Map.tsx so both sides of the swipe
// match the rest of the app shell.
const BASEMAP =
  "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json";

type Bounds = [number, number, number, number]; // [w, s, e, n]

// MapLibre image sources take corner coordinates in the order
// top-left, top-right, bottom-right, bottom-left.
function imageCoords(
  b: Bounds
): [[number, number], [number, number], [number, number], [number, number]] {
  const [w, s, e, n] = b;
  return [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
  ];
}

export default function SwipeCompare({
  bounds,
  before,
  after,
}: {
  bounds: Bounds;
  before: { url: string; label: string; bounds?: Bounds };
  after: { url: string; label: string; bounds?: Bounds };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const beforeEl = useRef<HTMLDivElement>(null);
  const afterEl = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [pct, setPct] = useState(50);

  // Two stacked map instances; 'move' listeners are detached while applying a
  // jumpTo so the synced camera doesn't ping-pong between the pair.
  useEffect(() => {
    if (!beforeEl.current || !afterEl.current) return;

    const beforeMap = new MapLibreMap({
      container: beforeEl.current,
      style: BASEMAP,
      minZoom: 5,
      maxZoom: 13,
      attributionControl: { compact: true },
    });
    const afterMap = new MapLibreMap({
      container: afterEl.current,
      style: BASEMAP,
      minZoom: 5,
      maxZoom: 13,
      attributionControl: false,
    });

    function syncOn() {
      beforeMap.on("move", beforeToAfter);
      afterMap.on("move", afterToBefore);
    }
    function syncOff() {
      beforeMap.off("move", beforeToAfter);
      afterMap.off("move", afterToBefore);
    }
    function beforeToAfter() {
      moveCamera(beforeMap, afterMap);
    }
    function afterToBefore() {
      moveCamera(afterMap, beforeMap);
    }
    function moveCamera(src: MapInstance, dst: MapInstance) {
      syncOff();
      const c = src.getCenter();
      dst.jumpTo(
        cameraPatch({
          center: [c.lng, c.lat],
          zoom: src.getZoom(),
          bearing: src.getBearing(),
          pitch: src.getPitch(),
        })
      );
      syncOn();
    }
    syncOn();

    const fit = (map: MapInstance) =>
      map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        { padding: 60, duration: 0 }
      );

    const addSwipeImage = (
      map: MapInstance,
      layer: { url: string; bounds?: Bounds }
    ) => {
      map.addSource("swipe-image", {
        type: "image",
        url: layer.url,
        coordinates: imageCoords(layer.bounds ?? bounds),
      });
      map.addLayer({
        id: "swipe-image",
        type: "raster",
        source: "swipe-image",
      });
    };

    // Only the first map to finish loading fits the bounds; its 'move' events
    // sync the camera to the other map. A late-arriving second 'load' must not
    // fit again or it would revert a user pan and desync the pair.
    let fitted = false;
    const onLoad = (
      map: MapInstance,
      layer: { url: string; bounds?: Bounds }
    ) => {
      addSwipeImage(map, layer);
      if (!fitted) {
        fitted = true;
        fit(map);
      }
    };

    beforeMap.on("load", () => onLoad(beforeMap, before));
    afterMap.on("load", () => onLoad(afterMap, after));

    return () => {
      beforeMap.remove();
      afterMap.remove();
    };
    // Maps are created once; the swipe imagery is fixed for the component's
    // lifetime (a new event pair mounts a fresh component).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFromPointer = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPct(pctFromClientX(clientX, rect.left, rect.width));
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#0b0e14]"
    >
      <div ref={beforeEl} className="absolute inset-0" />
      <div
        ref={afterEl}
        className="absolute inset-0"
        style={{ clipPath: clipPathFor(pct) }}
      />

      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
        {before.label}
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-10 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
        {after.label}
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Before / after swipe divider"
        aria-orientation="horizontal"
        aria-valuemin={5}
        aria-valuemax={95}
        aria-valuenow={Math.round(pct)}
        className="absolute inset-y-0 z-20 w-6 -translate-x-1/2 cursor-ew-resize touch-none outline-none"
        style={{ left: `${pct}%` }}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) updateFromPointer(e.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            setPct((p) => dragStep(p, -1));
            e.preventDefault();
          } else if (e.key === "ArrowRight") {
            setPct((p) => dragStep(p, 1));
            e.preventDefault();
          }
        }}
      >
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/80" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-[#0b0e14]/90 shadow-lg">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 3 L2 7 L5 11" />
            <path d="M9 3 L12 7 L9 11" />
          </svg>
        </div>
      </div>
    </div>
  );
}
