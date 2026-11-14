"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapInstance } from "maplibre-gl";
import {
  capToggleQueue,
  fmtDataDate,
  fmtDate,
  layerAvailable,
  toggleBudget,
  type TabKey,
  type ToggleLayerKey,
} from "@/lib/layers";
import { TPI_CLASSES } from "@/lib/tpi";
import type { CaseBundle } from "@/lib/types";
import Header from "./Header";
import LayersPanel from "./LayersPanel";
import Map from "./Map";
import { useMapLayers, type LayerState } from "./MapLayers";
import SidePanel from "./SidePanel";
import Timeline from "./Timeline";

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
  const threshold = bundle?.series?.tpi_threshold;
  const firstCriticalIdx = days.findIndex((day) => day.tpi >=
    (typeof threshold === "number" && Number.isFinite(threshold) ? threshold : 0.6));
  const metrics = bundle?.metricsView as Record<string, unknown> | undefined;
  const anchor = metrics?.damage_anchor;
  const damageAt = anchor && typeof anchor === "object"
    ? (anchor as Record<string, unknown>).at : metrics?.first_damage_at;
  const firstDamageIdx = typeof damageAt === "string"
    ? days.findIndex((day) => day.date.slice(0, 10) === damageAt.slice(0, 10)) : -1;
  const markers: { dayIndex: number; label: string; color: "red" | "amber" }[] = [];
  if (firstCriticalIdx >= 0) markers.push({ dayIndex: firstCriticalIdx, label: "first Critical", color: "amber" });
  if (firstDamageIdx >= 0) markers.push({ dayIndex: firstDamageIdx, label: "first damage", color: "red" });

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

  // v3 viz rule: at most 2 data layers at once — tab overlay-plan layers
  // count toward the budget, so the toggle cap depends on the active tab.
  const budget = toggleBudget(tab);

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
        // Dead entries (no raster in this bundle) are pruned before the cap
        // check so they can't push a live layer out of the budget.
        const { queue, off } = capToggleQueue(
          [
            ...enabledQueue.current.filter(
              (k) => k !== key && k !== EXCLUSIVE_PARTNER[key]
            ),
            key,
          ],
          budget,
          (k) => layerAvailable(bundle, k as ToggleLayerKey)
        );
        enabledQueue.current = queue;
        for (const k of off) next[k] = false;
      } else {
        enabledQueue.current = enabledQueue.current.filter((k) => k !== key);
      }
      return next;
    });
  }, [bundle, budget]);

  // Tab switches shrink the budget — evict the oldest enabled toggles that
  // no longer fit. Dead queue entries (raster absent from this bundle) are
  // dropped first; only live entries count against the budget.
  useEffect(() => {
    const { queue, off } = capToggleQueue(
      enabledQueue.current,
      budget,
      (k) => layerAvailable(bundle, k as ToggleLayerKey)
    );
    if (!off.length) return;
    enabledQueue.current = queue;
    setLayers((prev) => {
      const next = { ...prev };
      for (const k of off) next[k] = false;
      return next;
    });
  }, [bundle, budget]);

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

      {(bundle as CaseBundle & { fallback?: boolean; dataDate?: string }).fallback === true && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-800/50 bg-amber-950/60 px-4 py-1 text-xs text-amber-200">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 1.5 11 9.7H1z" />
            <path d="M6 4.3v2.4M6 8.4v.01" />
          </svg>
          Showing last saved data from{" "}
          {fmtDate(bundle.updated_at ?? (bundle as CaseBundle & { dataDate?: string }).dataDate)}
        </div>
      )}

      <main className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <Map bounds={bundle.bbox} onReady={setMap} />
          <LayersPanel layers={layers} onToggle={toggleLayer} bundle={bundle} budget={budget} />
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
        markers={markers.length ? markers : undefined}
        dayIndex={dayIndex}
        playing={playing}
        onSeek={setDayIndex}
        onPlayToggle={() => setPlaying((p) => !p)}
      />

      <footer className="flex min-h-9 shrink-0 flex-wrap items-center gap-x-4 gap-y-0.5 border-t border-zinc-800 bg-[#0b0e14] px-4 py-1 text-xs text-zinc-500">
        <span className="font-semibold text-zinc-400">TPI index (0–1) — Risk class</span>
        {TPI_CLASSES.map((c) => (
          <span key={c.key} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm" style={{ background: c.color }} />
            {c.label}{" "}
            {c.key === "critical"
              ? `(> ${c.min.toFixed(2)})`
              : `(${c.min.toFixed(2)} – ${c.max.toFixed(2)})`}
          </span>
        ))}
        <span>data {fmtDataDate(days[dayIndex]?.date)}</span>
        <span className="mx-2 hidden h-4 w-px bg-zinc-800 sm:block" />
        <span className="basis-full sm:basis-auto">
          Data: NASA GPM · SMAP · NASADEM · NISAR · Basemap © CARTO © OpenStreetMap · Boundaries © IBGE · Population: GPW (NASA SEDAC) / US Census
        </span>
      </footer>
    </div>
  );
}
