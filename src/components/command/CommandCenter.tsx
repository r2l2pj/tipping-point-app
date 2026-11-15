"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import type { AlertCardData } from "@/lib/alerts";
import EvidenceDetails from "./EvidenceDetails";
import GetAlertsCard from "./GetAlertsCard";
import LayersColumn from "./LayersColumn";
import MapStage from "./MapStage";
import PanelSection from "./PanelSection";
import { observedRows, type AlertList } from "./model/alerts";
import { priorityAreas } from "./model/areas";
import { availability, missingText } from "./model/availability";
import { dataStatus, freshnessText } from "./model/dataStatus";
import { classLabel, fmtKm2 } from "./model/format";
import { layerRows } from "./model/layerRegistry";
import { caseDirOf, effectiveBundle, productUrl, withLazy, zonesAreTrimmed } from "./model/lazy";
import { nightLightsCompare, radarCard } from "./model/radar";
import { evidence, replayCheckRows } from "./model/replayCheck";
import { sourceRows } from "./model/sources";
import { statusChip } from "./model/status";
import { chartForecastLabel, forecastTag, stepLabel, stepMarks, stepsFor } from "./model/steps";
import { criticalAreaTile, peopleTile, zoneSnapshot } from "./model/tiles";
import type { CcBundle } from "./model/types";
import PriorityAreas from "./PriorityAreas";
import PublicAlertsPanel from "./PublicAlertsPanel";
import RadarCard from "./RadarCard";
import RainSoilChart from "./RainSoilChart";
import ReplayCheck from "./ReplayCheck";
import SituationPanel from "./SituationPanel";
import SourceAges from "./SourceAges";
import { initialState, linkParams, PLAYBACK_MS, reduce, type Action, type ScreenState } from "./state";
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
  cases,
  alertList,
  botUrl,
  fontClass = "",
  initialCase,
  initialDay,
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
  const reducer = useCallback(
    (s: ScreenState, a: Action) => reduce(s, a, cases),
    [cases]
  );
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    ...initialState(cases, initialCase, initialDay),
    ...initial,
  }));
  const [drawer, setDrawer] = useState(false); // Layers drawer, narrow screens

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
        <p role="status" className="m-auto max-w-md p-6 text-center text-[15px]">
          Data unavailable: no case could be loaded. This does not mean there is no risk.
        </p>
      </div>
    );
  }

  const live = bundle.mode === "live";
  const step = steps[state.dayIndex];
  const status = dataStatus(bundle, nowMs);
  const chip = statusChip(bundle, steps, state.dayIndex, state.hazard);
  const rows = layerRows(bundle, state.layers, state.hazard, step?.date);
  const nightLights = nightLightsCompare(bundle);
  const comparePair =
    state.compareOpen === "radar" ? radar.compare.pair
    : state.compareOpen === "night-lights" ? nightLights.pair
    : undefined;
  const snap = zoneSnapshot(bundle, step?.date);
  const tag = forecastTag(bundle);
  const classesKm2 = bundle.riskPaused ? [] : Object.entries(bundle.summary?.classes_km2 ?? {});

  const viewOnMap = (alert: AlertCardData) => {
    onView("command");
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
      <div className="relative min-h-0 flex-1">
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
            >
              <GetAlertsCard botUrl={botUrl} />
            </PublicAlertsPanel>
          ) : (
            <>
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
                    area={criticalAreaTile(bundle, state.hazard, step?.date, step?.day)}
                    people={peopleTile(bundle, step?.date, step?.day)}
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
                    Model probabilities (24 h–14 d) are in the Layers column.
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
        forecastTag={tag}
        onSeek={(index) => dispatch({ type: "seek", index })}
        onPrev={() => dispatch({ type: "prev" })}
        onNext={() => dispatch({ type: "next" })}
        onPlayToggle={() => dispatch({ type: "togglePlay" })}
      />
        </div>
        </div>
      </div>

      <footer className="shrink-0 px-5 pb-2 pt-1.5 text-xs text-cc-faint">
        Data: NASA GPM · SMAP · NASADEM · NISAR · Basemap © CARTO © OpenStreetMap · Boundaries ©{" "}
        {caseDirOf(bundle) === "wa_2025" ? "US Census" : "IBGE"} · Population: GPW (NASA SEDAC) / US Census
      </footer>
    </div>
  );
}
