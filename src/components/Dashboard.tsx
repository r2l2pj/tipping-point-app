"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapInstance } from "maplibre-gl";
import { fmtDate, type TabKey } from "@/lib/layers";
import { TPI_CLASSES } from "@/lib/tpi";
import type { CaseBundle } from "@/lib/types";
import Header from "./Header";
import LayersPanel from "./LayersPanel";
import Map from "./Map";
import { useMapLayers, type LayerState } from "./MapLayers";
import SidePanel from "./SidePanel";
import Timeline from "./Timeline";

const MAX_DATA_LAYERS = 2; // v3 viz rule

const EXCLUSIVE_PARTNER: Partial<Record<keyof LayerState, keyof LayerState>> = {
  tpiFlood: "tpiSlide",
  tpiSlide: "tpiFlood",
};

export default function Dashboard({ cases }: { cases: CaseBundle[] }) {
  const [activeId, setActiveId] = useState(cases[0]?.id ?? "");
  const bundle = useMemo(
    () => cases.find((c) => c.id === activeId) ?? cases[0],
    [cases, activeId]
  );
  const days = bundle?.series?.days ?? [];

  const [dayIndex, setDayIndex] = useState(() =>
    Math.max(0, days.findIndex((d) => d.offset === 0))
  );
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<TabKey>("alert");
  const [map, setMap] = useState<MapInstance | null>(null);
  const [layers, setLayers] = useState<LayerState>({
    tpiFlood: false,
    tpiSlide: true,
    imerg: false,
    smap: false,
    nisar: false,
  });
  const enabledQueue = useRef<(keyof LayerState)[]>(["tpiSlide"]);

  // Playback loop.
  useEffect(() => {
    if (!playing || days.length < 2) return;
    const t = setInterval(
      () => setDayIndex((i) => (i + 1) % days.length),
      1200
    );
    return () => clearInterval(t);
  }, [playing, days.length]);

  const toggleLayer = useCallback((key: keyof LayerState) => {
    setLayers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (next[key]) {
        enabledQueue.current = [
          ...enabledQueue.current.filter(
            (k) => k !== key && k !== EXCLUSIVE_PARTNER[key]
          ),
          key,
        ];
        while (enabledQueue.current.length > MAX_DATA_LAYERS) {
          const oldest = enabledQueue.current.shift()!;
          next[oldest] = false;
        }
      } else {
        enabledQueue.current = enabledQueue.current.filter((k) => k !== key);
      }
      return next;
    });
  }, []);

  const selectCase = useCallback(
    (id: string) => {
      setActiveId(id);
      const b = cases.find((c) => c.id === id);
      const idx = (b?.series?.days ?? []).findIndex((d) => d.offset === 0);
      setDayIndex(Math.max(0, idx));
      setPlaying(false);
      setTab("alert");
      setLayers({ tpiFlood: false, tpiSlide: true, imerg: false, smap: false, nisar: false });
      enabledQueue.current = ["tpiSlide"];
    },
    [cases]
  );

  const replay = useCallback(() => {
    const first = cases.find((c) => c.mode === "replay");
    if (first) selectCase(first.id);
    setDayIndex(0);
    setPlaying(true);
  }, [cases, selectCase]);

  const showFlood = tab === "radar";
  const zones = useMapLayers(map, bundle, dayIndex, layers, showFlood, tab);

  if (!bundle) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#0b0e14] text-sm text-zinc-500">
        No data yet — run <code className="ml-1">bun run sync:data</code>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0b0e14] text-zinc-100">
      <Header cases={cases} activeId={activeId} onSelect={selectCase} onReplay={replay} />

      {(bundle as CaseBundle & { fallback?: boolean }).fallback === true && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-800/50 bg-amber-950/60 px-4 py-1 text-xs text-amber-200">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 1.5 11 9.7H1z" />
            <path d="M6 4.3v2.4M6 8.4v.01" />
          </svg>
          Showing last saved data from {fmtDate(bundle.updated_at)}
        </div>
      )}

      <main className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <Map bounds={bundle.bbox} onReady={setMap} />
          <LayersPanel layers={layers} onToggle={toggleLayer} bundle={bundle} />
        </div>
        <SidePanel
          tab={tab}
          onTab={setTab}
          bundle={bundle}
          zones={zones}
          dayIndex={dayIndex}
          onConfirmRadar={() => setTab("radar")}
        />
      </main>

      <Timeline
        series={bundle.series}
        dayIndex={dayIndex}
        playing={playing}
        onSeek={setDayIndex}
        onPlayToggle={() => setPlaying((p) => !p)}
      />

      <footer className="flex h-9 shrink-0 items-center gap-4 border-t border-zinc-800 bg-[#0b0e14] px-4 text-xs text-zinc-500">
        <span className="font-semibold text-zinc-400">TPI (Tipping Point Index) — Risk class</span>
        {TPI_CLASSES.map((c) => (
          <span key={c.key} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm" style={{ background: c.color }} />
            {c.label}{" "}
            {c.key === "critical"
              ? `(> ${c.min.toFixed(2)})`
              : `(${c.min.toFixed(2)} – ${c.max.toFixed(2)})`}
          </span>
        ))}
        <span className="mx-2 h-4 w-px bg-zinc-800" />
        <span>Data: NASA GPM · SMAP · NASADEM · NISAR · © OpenStreetMap</span>
      </footer>
    </div>
  );
}
