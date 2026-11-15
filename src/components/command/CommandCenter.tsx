"use client";

import MethodsDrawer from "./MethodsDrawer";
import { liveClasses } from "@/lib/contract";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import type { AlertCardData } from "@/lib/alerts";
import EvidenceDetails from "./EvidenceDetails";
import GetAlertsCard from "./GetAlertsCard";
import LayersColumn from "./LayersColumn";
import MapStage, { type MapFocus } from "./MapStage";
import StartHere from "./StartHere";
import PanelSection from "./PanelSection";
import { observedRows, type AlertList } from "./model/alerts";
import { expandLayerUrls } from "./model/layerUrls";
import { priorityAreas } from "./model/areas";
import { availability, missingText } from "./model/availability";
import { dataStatus, freshnessText } from "./model/dataStatus";
import { classLabel, fmtKm2 } from "./model/format";
import { layerRows, visibleLayerRows } from "./model/layerRegistry";
import { caseDirOf, effectiveBundle, productUrl, withLazy, zonesAreTrimmed } from "./model/lazy";
import { nightLightsCompare, radarCard } from "./model/radar";
import { evidence, replayCheckRows } from "./model/replayCheck";
import { sourceRows } from "./model/sources";
import { statusChip } from "./model/status";
import { chartForecastLabel, forecastTag, frameFor, issuedFrame, stepLabel, stepMarks, stepsFor, timelineForecastTag } from "./model/steps";
import { criticalAreaTile, peopleTile, zoneSnapshot } from "./model/tiles";
import type { CcBundle } from "./model/types";
import PriorityAreas from "./PriorityAreas";
import PublicAlertsPanel from "./PublicAlertsPanel";
import RadarCard from "./RadarCard";
import RainSoilChart from "./RainSoilChart";
import ReplayCheck from "./ReplayCheck";
import SituationPanel from "./SituationPanel";
import SourceAges from "./SourceAges";
import { initialState, linkParams, PLAYBACK_MS, reduce, type Action, type ScreenState, type DeepLink, isFeatured } from "./state";
import StatusBlock from "./StatusBlock";
import Tiles from "./Tiles";
import TimelineBar from "./TimelineBar";
import TopBar, { type View } from "./TopBar";
import { useGeo } from "./useGeo";
import { useInsets } from "./useInsets";

export interface CommandCenterProps {
  cases: CcBundle[];
  alertList: AlertList;
  botUrl?: string;
  fontClass?: string;
  // `?case=<id|alias>` deep link: the case the screen opens on.
  initialCase?: string;
  // `?day=<offset>` deep link: day offset from the event day.
  initialDay?: number | string;
  deepLink?: DeepLink;
}

// Browser clock, minute steps. Undefined on the server and during hydration,
// so ages and "stale" are computed on the client only (Cache Components).
const subscribeClock = (onTick: () => void) => {
  const t = setInterval(onTick, 60_000);
  return () => clearInterval(t);
};
const clockNow = (): number | undefined => Math.floor(Date.now() / 60_000) * 60_000;
const noClock = (): number | undefined => undefined;

// The address decides the view: /alerts is the Public Alerts view. The switch
// uses the History API, so the client root is not remounted and the map, the
// step and the layers stay as they were.
export default function CommandCenter(props: CommandCenterProps) {
  const pathname = usePathname();
  const view: View = pathname === "/alerts" ? "public" : "command";
  const nowMs = useSyncExternalStore(subscribeClock, clockNow, noClock);
  const onView = useCallback((next: View) => {
    const path = next === "public" ? "/alerts" : "/";
    // The case and step of the address stay with the view.
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path + window.location.search);
    }
  }, []);
  return <CommandCenterView {...props} view={view} onView={onView} nowMs={nowMs} />;
}

export function CommandCenterView({
  cases: rawCases,
  alertList,
  botUrl,
  fontClass = "",
  initialCase,
  initialDay,
  deepLink,
  view,
  onView,
  nowMs,
  initial,
}: CommandCenterProps & {
  view: View;
  onView: (v: View) => void;
  nowMs?: number;
  initial?: Partial<ScreenState>; // tests
}) {
  // Layer URLs travel compacted (page budget): restore them once, here.
  const cases = useMemo(() => rawCases.map(expandLayerUrls), [rawCases]);
  const reducer = useCallback(
    (s: ScreenState, a: Action) => reduce(s, a, cases),
    [cases]
  );
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    ...initialState(cases, initialCase, initialDay, deepLink),
    ...initial,
  }));
  const [drawer, setDrawer] = useState(false); // Layers drawer, narrow screens
  const [focus, setFocus] = useState<MapFocus>(); // "View on the map" target

  useEffect(() => {
    if (!state.playing) return;
    const t = setInterval(() => dispatch({ type: "tick" }), PLAYBACK_MS);
    return () => clearInterval(t);
  }, [state.playing]);

  // The address names the case and step in view, so a reload or a copied
  // link opens the same thing. Not written while playing.
  useEffect(() => {
    if (state.playing) return;
    const want = linkParams(cases.find((c) => c.id === state.activeId), state.dayIndex);
    const params = new URLSearchParams(window.location.search);
    for (const key of ["case", "day"] as const) {
      const v = want[key];
      if (v === undefined) params.delete(key);
      else params.set(key, v);
    }
    const query = params.toString();
    const search = query ? `?${query}` : "";
    if (search !== window.location.search) {
      window.history.replaceState(null, "", window.location.pathname + search);
    }
  }, [cases, state.activeId, state.dayIndex, state.playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dispatch({ type: "escape" });
        setDrawer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The loader sends a trimmed bundle: the full priority zones and the scar
  // candidates are fetched here by URL (shared cache with the map hook). A
  // pending token of the loader wins over any value.
  const loaded = cases.find((c) => c.id === state.activeId);
  const zonesUrl = loaded && zonesAreTrimmed(loaded) ? productUrl(loaded, "priority_zones") : undefined;
  const scarsUrl = loaded && !loaded.scars ? productUrl(loaded, "landslide_candidates") : undefined;
  const fullZones = useGeo(zonesUrl);
  const scars = useGeo(scarsUrl);
  // Memoized: the bundle, the steps and the areas keep their identity
  // between timeline steps, so a step does not rebuild the map sources, the
  // pins or the zone list (that made playback stutter).
  const bundle = useMemo(
    () => loaded && withLazy(effectiveBundle(loaded), {
      zones: fullZones, zonesRequested: !!zonesUrl,
      scars, scarsRequested: !!scarsUrl,
    }),
    [loaded, fullZones, zonesUrl, scars, scarsUrl]
  );
  const steps = useMemo(() => stepsFor(bundle), [bundle]);
  const areas = useMemo(() => priorityAreas(bundle), [bundle]);
  const marks = useMemo(() => (bundle ? stepMarks(bundle, steps) : []), [bundle, steps]);
  const radar = useMemo(() => (bundle ? radarCard(bundle) : undefined), [bundle]);
  const observed = useMemo(() => observedRows(bundle), [bundle]);

  const seek = useCallback((index: number) => dispatch({ type: "seek", index }), []);
  const toggleTable = useCallback(() => dispatch({ type: "toggleTable" }), []);

  // Floating cards over the full-bleed map (wide screens).
  const stageRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const insets = useInsets(stageRef, layersRef, panelRef, timelineRef);
  const root = `cc-root flex min-h-screen flex-col min-[900px]:h-screen ${fontClass}`;

  if (!bundle || !radar) {
    return (
      <div className={root}>
        <TopBar cases={cases} bundle={undefined} view={view} onView={onView}
          onMode={() => {}} onSelectCase={() => {}}
          freshness="Unknown age · no data loaded" freshnessKind="unknown-age" />
        <main className="m-auto max-w-md">
          <p role="status" className="p-6 text-center text-[15px]">
            Data unavailable: no case could be loaded. This does not mean there is no risk.
          </p>
        </main>
      </div>
    );
  }

  const live = bundle.mode === "live";
  const step = steps[state.dayIndex];
  const status = dataStatus(bundle, nowMs);
  const chip = statusChip(bundle, steps, state.dayIndex, state.hazard);
  const rows = visibleLayerRows(layerRows(bundle, state.layers, state.hazard, step?.date, state.probHorizon));
  const nightLights = nightLightsCompare(bundle);
  const comparePair =
    state.compareOpen === "radar" ? radar.compare.pair
    : state.compareOpen === "night-lights" ? nightLights.pair
    : undefined;
  const snap = zoneSnapshot(bundle, step?.date);
  // The ML card's global tables travel on one case only (page budget).
  const sharedMl = cases.find((c) => c.ml?.when)?.ml;
  const mergedMl = bundle.ml && sharedMl ? { ...sharedMl, ...bundle.ml } : bundle.ml;
  const tag = forecastTag(bundle);
  // The TPI frame on the map, one source of truth for the tiles and the
  // timeline chip: the "forecast issued this day" overlay when on, else the
  // step's own frame (TPI index on).
  const tpiOn = state.layers.includes("tpi");
  const overlayFrame = tpiOn ? issuedFrame(bundle, step?.date, state.hazard, state.issueLead)?.layer : undefined;
  const mapFrame = overlayFrame ?? (tpiOn ? frameFor(bundle, step?.date, state.hazard)?.layer : undefined);
  // Area by class of the selected hazard (summary v2), or the v1 union.
  const classesKm2 = bundle.riskPaused ? [] : Object.entries(liveClasses(bundle.summary, state.hazard) ?? {});

  // Gap 2: the card's own geometry frames the map; a card without one falls
  // back to the priority area of the same name.
  const viewOnMap = (alert: AlertCardData) => {
    onView("command");
    if (alert.bbox || alert.centroid) {
      setFocus({ bbox: alert.bbox, center: alert.centroid, key: Date.now() });
      return;
    }
    const name = alert.region ?? alert.area;
    const match = areas.find((a) => a.name === name);
    if (match && state.selectedArea !== match.rank) dispatch({ type: "selectArea", rank: match.rank });
  };

  return (
    <div className={root} data-view={view} data-case={bundle.id} data-layers={state.layers.join(",")}>
      <TopBar
        cases={cases}
        bundle={bundle}
        view={view}
        onView={onView}
        onMode={(mode) => dispatch({ type: "setMode", mode })}
        onSelectCase={(id) => dispatch({ type: "selectCase", id })}
        freshness={freshnessText(status, nowMs)}
        freshnessKind={status.kind}
      />

      {/* Wide: the map fills the whole area and the cards float over it.
          Narrow: one column (map, panel, timeline); Layers is a drawer. */}
      <main className="relative min-h-0 flex-1">
        <MapStage
          bundle={bundle}
          steps={steps}
          state={state}
          areas={areas}
          status={status}
          comparePair={comparePair}
          dispatch={dispatch}
          insets={insets}
          stageRef={stageRef}
          focus={focus}
          featuredCase={(() => {
            const f = cases.find((c) => c.mode === "replay" && isFeatured(c));
            return f ? { id: f.id, short: "Uruguaiana Oct 2026" } : undefined;
          })()}
          onToggleLayers={() => {
            dispatch({ type: "toggleLayersOpen" });
            setDrawer((d) => !d);
          }}
        />
        {drawer && (
          <button type="button" aria-label="Close the Layers column" onClick={() => setDrawer(false)}
            className="fixed inset-0 z-30 bg-black/40 min-[900px]:hidden" />
        )}
        <div className="pointer-events-none z-20 flex flex-col gap-3 p-3 min-[900px]:absolute min-[900px]:inset-0 min-[900px]:grid min-[900px]:grid-cols-[auto_minmax(0,1fr)_auto] min-[900px]:grid-rows-[minmax(0,1fr)_auto]">
        <div ref={layersRef} className="pointer-events-auto flex min-h-0 max-[899px]:contents min-[900px]:col-start-1 min-[900px]:row-start-1 min-[900px]:self-start min-[900px]:max-h-full">
        <LayersColumn
          bundle={bundle}
          rows={rows}
          hazard={state.hazard}
          layers={state.layers}
          notice={state.layerNotice}
          probHorizon={state.probHorizon}
          stepDate={step?.date}
          onHazard={(hazard) => dispatch({ type: "setHazard", hazard })}
          onToggle={(id) => dispatch({ type: "toggleLayer", id })}
          onProbHorizon={(horizon) => dispatch({ type: "setProbHorizon", horizon })}
          onClose={() => setDrawer(false)}
          className={`${drawer ? "max-[899px]:flex" : "max-[899px]:hidden"} ${state.layersOpen ? "min-[900px]:flex" : "min-[900px]:hidden"}`}
        />

        </div>

        <div ref={panelRef} className="pointer-events-auto flex min-h-0 min-[900px]:col-start-3 min-[900px]:row-span-2 min-[900px]:row-start-1 min-[900px]:self-start min-[900px]:max-h-full">
        <SituationPanel label={view === "public" ? "Public alerts" : "Situation overview"}>
          {view === "public" ? (
            <PublicAlertsPanel
              alertList={alertList}
              live={live}
              onGoToNow={() => dispatch({ type: "setMode", mode: "now" })}
              onViewOnMap={viewOnMap}
              observed={observed}
              observedOn={state.layers.includes("flood")}
              onShowObserved={() => dispatch({ type: "toggleLayer", id: "flood" })}
              bundle={bundle}
              stepDate={step?.date}
            >
              <GetAlertsCard botUrl={botUrl} />
            </PublicAlertsPanel>
          ) : (
            <>
              <StartHere cases={cases} dispatch={dispatch} />
              {/* Response first, prediction second (ruling L27). */}
              <PanelSection label="Now on the ground">
                <RadarCard
                  radar={radar}
                  floodOn={state.layers.includes("flood")}
                  compareOpen={state.compareOpen === "radar"}
                  onConfirm={() => dispatch({ type: "confirmRadar" })}
                  onShowFlood={() => dispatch({ type: "toggleLayer", id: "flood" })}
                  onCompare={() =>
                    dispatch(state.compareOpen === "radar" ? { type: "closeCompare" } : { type: "openCompare", kind: "radar" })}
                />

                <div>
                  <h3 className="m-0 mb-1 text-[13px] font-semibold text-cc-muted">Who is affected</h3>
                  <Tiles
                    area={criticalAreaTile(bundle, state.hazard, step?.date, step?.day, overlayFrame)}
                    people={peopleTile(bundle, step?.date, step?.day, overlayFrame)}
                  />
                  {classesKm2.length > 0 && (
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-4 text-xs text-cc-muted" aria-label="Area by class">
                      {classesKm2.map(([cls, km2]) => (
                        <div key={cls} className="flex justify-between border-t border-cc-rule py-0.5">
                          <dt>class {classLabel(cls)}</dt><dd>{fmtKm2(km2)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>

                <PriorityAreas
                  areas={areas}
                  missingText={missingText(availability(bundle, "priority_zones"))}
                  expanded={state.listExpanded}
                  selected={state.selectedArea}
                  asOf={snap.asOf}
                  dimmed={snap.dimmed}
                  onToggleAll={() => dispatch({ type: "toggleList" })}
                  onSelect={(rank) => dispatch({ type: "selectArea", rank })}
                  lowerBound={bundle.mode === "replay"}
                  partsNote={bundle.mode === "live"}
                  onJumpToSnapshot={bundle.mode === "replay" && snap.iso
                    ? (() => {
                        const i = steps.findIndex((st) => st.date.slice(0, 10) === snap.iso!.slice(0, 10));
                        return i >= 0 ? () => seek(i) : undefined;
                      })()
                    : undefined}
                />
              </PanelSection>

              <PanelSection label="Prediction">
                <StatusBlock
                  chip={chip}
                  status={status}
                  stepLabel={step ? stepLabel(bundle, step) : undefined}
                >
                  {live && chip.kind === "no-data" && cases.some((c) => c.mode === "replay") && (
                    <p className="mt-1.5 text-[13px]">
                      Past events with published data are in Replay.{" "}
                      <button type="button" onClick={() => dispatch({ type: "setMode", mode: "replay" })}
                        className="font-semibold text-cc-accent underline decoration-dotted underline-offset-2">
                        Open Replay
                      </button>
                    </p>
                  )}
                </StatusBlock>

                <RainSoilChart
                  bundle={bundle}
                  steps={steps}
                  dayIndex={state.dayIndex}
                  asTable={state.chartAsTable}
                  forecastLabel={chartForecastLabel(bundle) ?? "source not published"}
                  onSeek={seek}
                  onToggleTable={toggleTable}
                />
                {rows.some((r) => r.id === "ptrigger" && r.available) && (
                  <p className="m-0 text-xs text-cc-faint">
                    Relative likelihood of a rain-triggered landslide (24 h–14 d) is in the Layers column.
                  </p>
                )}
              </PanelSection>

              {!live && (
                <ReplayCheck
                  rows={replayCheckRows(bundle)}
                  detailsOpen={state.detailsOpen}
                  onToggleDetails={() => dispatch({ type: "toggleDetails" })}
                >
                  <EvidenceDetails
                    evidence={evidence(bundle, step?.day)}
                    swot={bundle.swot}
                    ml={mergedMl}
                    mlImportance={bundle.mlImportance}
                    evidenceRows={rows.filter((r) => r.group === "Replay evidence")}
                    nightLights={nightLights}
                    onToggleLayer={(id) => dispatch({ type: "toggleLayer", id })}
                    onCompareNightLights={() => dispatch({ type: "openCompare", kind: "night-lights" })}
                  />
                </ReplayCheck>
              )}

              <GetAlertsCard botUrl={botUrl} />
            </>
          )}
          {/* Source dates sit in the panel, so the floating timeline stays low. */}
          <SourceAges rows={sourceRows(bundle, nowMs)} />
        </SituationPanel>
        </div>

        <div ref={timelineRef} className="pointer-events-auto min-w-0 min-[900px]:col-span-2 min-[900px]:col-start-1 min-[900px]:row-start-2">
      <TimelineBar
        steps={steps}
        marks={marks}
        dayIndex={state.dayIndex}
        playing={state.playing}
        forecastTag={timelineForecastTag(bundle)}
        mapFrame={mapFrame}
        onSeek={(index) => dispatch({ type: "seek", index })}
        onPrev={() => dispatch({ type: "prev" })}
        onNext={() => dispatch({ type: "next" })}
        onPlayToggle={() => dispatch({ type: "togglePlay" })}
      />
        </div>
        </div>
      </main>

      <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-5 pb-2 pt-1.5 text-xs text-cc-faint">
        <span className="min-w-0 grow">
          Data: NASA GPM · SMAP · NASADEM · NISAR · OPERA · Forecast rain: NOAA GFS (the only non-NASA input) · Basemap © CARTO © OpenStreetMap · Boundaries ©{" "}
          {caseDirOf(bundle) === "wa_2025" ? "US Census · Landslide points: Washington Geological Survey" : "IBGE"} · Population: GPW (NASA SEDAC) / US Census
          {typeof (bundle.metricsView as Record<string, unknown> | undefined)?.flood_ems_iou === "number" &&
            " · Flood reference: © European Union, Copernicus Emergency Management Service"}
        </span>
        {/* Judges (conductor): methods links, closed by default. */}
        <MethodsDrawer />
      </footer>
    </div>
  );
}
