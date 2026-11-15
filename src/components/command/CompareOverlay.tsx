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
import { FLOODED_FILL, FLOODED_OUTLINE, type ComparePair } from "./model/radar";
import { ISSUE_LEADS, type IssueLead } from "./model/steps";

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
// L42: HH | HV switch when the radar pair carries an HV pair; switching
// remounts the two maps on the other images.
export default function CompareOverlay({
  pair,
  onClose,
  controlsRef,
  init,
  forecastCtl,
}: {
  pair: ComparePair;
  onClose: () => void;
  controlsRef: MutableRefObject<CompareControls | null>;
  init?: { before?: string; after?: string; pol?: "HH" | "HV" };
  // L52 (forecast swipe): the lead chips; `lead` is the pair's own lead.
  forecastCtl?: { lead: IssueLead; leads: readonly IssueLead[]; onLead: (k: IssueLead) => void };
}) {
  const [pol, setPol] = useState<"HH" | "HV">(init?.pol ?? "HH");
  const stack = pair.stack;
  const n = stack?.dates.length ?? 0;
  const at = (d: string | undefined, fallback: number) => {
    const i = d && stack ? stack.dates.indexOf(d.slice(0, 10)) : -1;
    return i >= 0 ? i : fallback;
  };
  // Lucas: the dates are picked in the Radar card (chips), not here.
  const bi = at(init?.before, 0);
  const ai = Math.max(bi, at(init?.after, Math.max(0, n - 1)));
  // Same tag wording as the pair: "NISAR radar before (HH) — Sep 30, 2026".
  const sideAt = (i: number, side: "before" | "after") => {
    const f = stack!.frames[stack!.dates[i]];
    const s = (pol === "HV" ? f.HV ?? f.HH : f.HH ?? f.HV)!;
    const p = s === f.HV ? "HV" : "HH";
    return { ...s, label: s.label.replace(/ (HH|HV) — /, ` ${side} (${p}) — `) };
  };
  const shown = stack
    ? { ...pair, before: sideAt(bi, "before"), after: sideAt(ai, "after") }
    : pol === "HV" && pair.hv ? { ...pair, before: pair.hv.before, after: pair.hv.after } : pair;
  const hasHv = !!pair.hv || !!stack?.dates.some((d) => stack.frames[d].HV);
  const seg = (on: boolean) =>
    `rounded-full px-2.5 py-0.5 text-xs font-semibold ${on ? "bg-cc-accent text-white" : "text-cc-ink"}`;
  return (
    <>
      <CompareMaps key={`${pol}-${bi}-${ai}`} pair={shown} onClose={onClose} controlsRef={controlsRef} />
      {(hasHv || forecastCtl) && (
        <div className={`absolute z-30 flex -translate-x-1/2 flex-col items-center gap-1 ${forecastCtl ? "top-20" : stack ? "top-12" : "top-3"}`}
          // Centred on the visible map, never under the floating cards.
          style={{ left: "calc(var(--cc-il, 0px) + (100% - var(--cc-il, 0px) - var(--cc-ir, 0px)) / 2)",
            maxWidth: "calc(100% - var(--cc-il, 0px) - var(--cc-ir, 0px) - 24px)" }}>
          {forecastCtl && (
            <div role="group" aria-label="Forecast lead" data-forecast-leads
              className="flex items-center gap-1 rounded-full border border-cc-line-strong bg-white/95 p-[3px] shadow">
              <span className="px-1.5 text-xs text-cc-muted">Lead</span>
              {ISSUE_LEADS.map((k) => (
                <button key={k} type="button" aria-pressed={forecastCtl.lead === k}
                  disabled={!forecastCtl.leads.includes(k)}
                  onClick={() => forecastCtl.onLead(k)}
                  className={`${seg(forecastCtl.lead === k)} disabled:opacity-40`}>{k} {k === 1 ? "day" : "days"} before</button>
              ))}
            </div>
          )}
          {hasHv && (
            <div role="group" aria-label="Polarization" data-polarization
              className="flex items-center gap-1 rounded-full border border-cc-line-strong bg-white/95 p-[3px] shadow">
              <span className="px-1.5 text-xs text-cc-muted">Polarization</span>
              {(["HH", "HV"] as const).map((p) => (
                <button key={p} type="button" aria-pressed={pol === p} onClick={() => setPol(p)} className={seg(pol === p)}>{p}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function CompareMaps({
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
  // QA (v6 demo): start the divider in the middle of the VISIBLE map — the
  // floating cards cover the stage edges (--cc-il / --cc-ir insets).
  useEffect(() => {
    // The card insets are measured after the first paint (deep links open the
    // swipe at once): read them once they have settled.
    const t = setTimeout(() => {
      const el = containerRef.current;
      if (!el || !el.clientWidth || dragging.current) return;
      const css = getComputedStyle(el);
      const il = parseFloat(css.getPropertyValue("--cc-il")) || 0;
      const ir = parseFloat(css.getPropertyValue("--cc-ir")) || 0;
      const w = el.clientWidth;
      const mid = ((il + (w - il - ir) / 2) / w) * 100;
      if (Number.isFinite(mid)) setPct(Math.min(SWIPE_MAX_PCT, Math.max(SWIPE_MIN_PCT, mid)));
    }, 700);
    return () => clearTimeout(t);
  }, []);

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
      // Flooded area (radar) in its own colour above both radar images.
      if (pair.flood) {
        map.addSource("swipe-flood", { type: "geojson", data: pair.flood.url });
        map.addLayer({ id: "swipe-flood-fill", type: "fill", source: "swipe-flood",
          paint: { "fill-color": FLOODED_FILL, "fill-opacity": 0.35 } });
        map.addLayer({ id: "swipe-flood-line", type: "line", source: "swipe-flood",
          paint: { "line-color": FLOODED_OUTLINE, "line-width": 1.2 } });
      }
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
      {/* MapLibre styles its container `.maplibregl-map { position: relative }`,
          which overrides `absolute inset-0` on the container itself: the
          div collapsed to 0 px (canvas 300 px, clipped) and the comparison
          rendered blank. Each map fills its own positioned box instead. */}
      <div className="absolute inset-0">
        <div ref={beforeEl} className="h-full w-full" />
      </div>
      <div className="absolute inset-0" style={{ clipPath: clipPathFor(pct) }}>
        <div ref={afterEl} className="h-full w-full" />
      </div>
      <div className={tag} style={{ left: "calc(var(--cc-il, 0px) + 56px)", top: 44 }}>{pair.before.label}</div>
      <div className={tag} style={{ right: "calc(var(--cc-ir, 0px) + 68px)" }}>{pair.after.label}</div>
      {pair.flood && (
        <div data-swipe-legend className="pointer-events-none absolute bottom-12 z-10 flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-semibold text-cc-ink shadow"
          style={{ left: "calc(var(--cc-il, 0px) + 56px)" }}>
          <span className="inline-block h-3 w-4 rounded-sm border border-white" style={{ background: FLOODED_FILL, outline: "1px solid #5b6870" }} />
          {pair.flood.label}
        </div>
      )}
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
