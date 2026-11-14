"use client";

import { useCallback, useEffect, useReducer, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import type { AlertCardData } from "@/lib/alerts";
import EvidenceDetails from "./EvidenceDetails";
import GetAlertsCard from "./GetAlertsCard";
import LayersColumn from "./LayersColumn";
import MapStage from "./MapStage";
import type { AlertList } from "./model/alerts";
import { priorityAreas } from "./model/areas";
import { availability, missingText } from "./model/availability";
import { dataStatus, freshnessText } from "./model/dataStatus";
import { fmtKm2 } from "./model/format";
import { layerRows } from "./model/layerRegistry";
import { caseDirOf, effectiveBundle, productUrl, withLazy, zonesAreTrimmed } from "./model/lazy";
import { nightLightsCompare, radarCard } from "./model/radar";
import { evidence, replayCheckRows } from "./model/replayCheck";
import { sourceRows } from "./model/sources";
import { statusChip } from "./model/status";
import { forecastSource, forecastTag, stepMarks, stepsFor } from "./model/steps";
import { criticalAreaTile, peopleTile, zoneSnapshot } from "./model/tiles";
import type { CcBundle } from "./model/types";
import PriorityAreas from "./PriorityAreas";
import PublicAlertsPanel from "./PublicAlertsPanel";
import RadarCard from "./RadarCard";
import RainSoilChart from "./RainSoilChart";
import ReplayCheck from "./ReplayCheck";
import SituationPanel from "./SituationPanel";
import SourceAges from "./SourceAges";
import { initialState, PLAYBACK_MS, reduce, type Action, type ScreenState } from "./state";
import StatusBlock from "./StatusBlock";
import Tiles from "./Tiles";
import TimelineBar from "./TimelineBar";
import TopBar, { type View } from "./TopBar";
import { useGeo } from "./useGeo";

export interface CommandCenterProps {
  cases: CcBundle[];
  alertList: AlertList;
  botUrl?: string;
  fontClass?: string;
  // Path prefix of the two routes ("" for / and /alerts).
  basePath?: string;
  // `?case=<id|alias>` deep link: the case the screen opens on.
  initialCase?: string;
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
  const base = props.basePath ?? "";
  const pathname = usePathname();
  const view: View = pathname === `${base}/alerts` ? "public" : "command";
  const nowMs = useSyncExternalStore(subscribeClock, clockNow, noClock);
  const onView = useCallback(
    (next: View) => {
      const path = next === "public" ? `${base}/alerts` : base || "/";
      if (window.location.pathname !== path) window.history.pushState(null, "", path);
    },
    [base]
  );
  return <CommandCenterView {...props} view={view} onView={onView} nowMs={nowMs} />;
}

export function CommandCenterView({
  cases,
  alertList,
  botUrl,
  fontClass = "",
  initialCase,
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
    ...initialState(cases, initialCase),
    ...initial,
  }));
  const [drawer, setDrawer] = useState(false); // Layers drawer, narrow screens

  useEffect(() => {
    if (!state.playing) return;
    const t = setInterval(() => dispatch({ type: "tick" }), PLAYBACK_MS);
    return () => clearInterval(t);
  }, [state.playing]);

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
  const bundle = loaded && withLazy(effectiveBundle(loaded), {
    zones: fullZones, zonesRequested: !!zonesUrl,
    scars, scarsRequested: !!scarsUrl,
  });
  const root = `cc-root flex min-h-screen flex-col min-[900px]:h-screen ${fontClass}`;

  if (!bundle) {
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
  const steps = stepsFor(bundle);
  const step = steps[state.dayIndex];
  const status = dataStatus(bundle, nowMs);
  const chip = statusChip(bundle, steps, state.dayIndex, state.hazard);
  const areas = priorityAreas(bundle);
  const rows = layerRows(bundle, state.layers, state.hazard, step?.date);
  const radar = radarCard(bundle);
  const nightLights = nightLightsCompare(bundle);
  const comparePair =
    state.compareOpen === "radar" ? radar.compare.pair
    : state.compareOpen === "night-lights" ? nightLights.pair
    : undefined;
  const snap = zoneSnapshot(bundle, step?.date);
  const tag = forecastTag(bundle);
  const classesKm2 = Object.entries(bundle.summary?.classes_km2 ?? {});

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

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 min-[900px]:flex-row">
        {drawer && (
          <button type="button" aria-label="Close the Layers column" onClick={() => setDrawer(false)}
            className="fixed inset-0 z-30 bg-black/40 min-[900px]:hidden" />
        )}
        <LayersColumn
          bundle={bundle}
          rows={rows}
          hazard={state.hazard}
          layers={state.layers}
          notice={state.layerNotice}
          onHazard={(hazard) => dispatch({ type: "setHazard", hazard })}
          onToggle={(id) => dispatch({ type: "toggleLayer", id })}
          onClose={() => setDrawer(false)}
          className={`${drawer ? "max-[899px]:flex" : "max-[899px]:hidden"} ${state.layersOpen ? "min-[900px]:flex" : "min-[900px]:hidden"}`}
        />

        <MapStage
          bundle={bundle}
          steps={steps}
          state={state}
          areas={areas}
          status={status}
          comparePair={comparePair}
          dispatch={dispatch}
          onToggleLayers={() => {
            dispatch({ type: "toggleLayersOpen" });
            setDrawer((d) => !d);
          }}
        />

        <SituationPanel label={view === "public" ? "Public alerts" : "Situation overview"}>
          {view === "public" ? (
            <PublicAlertsPanel
              alertList={alertList}
              live={live}
              onGoToNow={() => dispatch({ type: "setMode", mode: "now" })}
              onViewOnMap={viewOnMap}
            >
              <GetAlertsCard botUrl={botUrl} />
            </PublicAlertsPanel>
          ) : (
            <>
              <StatusBlock
                chip={chip}
                status={status}
                stepLabel={step ? `${step.top}${step.sub ? ` (${step.sub})` : ""}${step.forecast ? " · forecast day" : ""}` : undefined}
                forecastSource={forecastSource(bundle)}
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

              <Tiles
                area={criticalAreaTile(bundle, state.hazard, step?.date)}
                people={peopleTile(bundle, step?.date)}
              />
              {classesKm2.length > 0 && (
                <dl className="grid grid-cols-2 gap-x-4 text-xs text-cc-muted" aria-label="Area by class">
                  {classesKm2.map(([cls, km2]) => (
                    <div key={cls} className="flex justify-between border-t border-cc-rule py-0.5">
                      <dt>class {cls}</dt><dd>{fmtKm2(km2)}</dd>
                    </div>
                  ))}
                </dl>
              )}

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

              <RainSoilChart
                bundle={bundle}
                steps={steps}
                dayIndex={state.dayIndex}
                asTable={state.chartAsTable}
                forecastLabel={forecastSource(bundle) ?? "source not published"}
                onSeek={(index) => dispatch({ type: "seek", index })}
                onToggleTable={() => dispatch({ type: "toggleTable" })}
              />

              <RadarCard
                radar={radar}
                floodOn={state.layers.includes("flood")}
                compareOpen={state.compareOpen === "radar"}
                onConfirm={() => dispatch({ type: "confirmRadar" })}
                onShowFlood={() => dispatch({ type: "toggleLayer", id: "flood" })}
                onCompare={() =>
                  dispatch(state.compareOpen === "radar" ? { type: "closeCompare" } : { type: "openCompare", kind: "radar" })}
              />

              {!live && (
                <ReplayCheck
                  rows={replayCheckRows(bundle)}
                  detailsOpen={state.detailsOpen}
                  onToggleDetails={() => dispatch({ type: "toggleDetails" })}
                >
                  <EvidenceDetails
                    evidence={evidence(bundle)}
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
        </SituationPanel>
      </div>

      <TimelineBar
        steps={steps}
        marks={stepMarks(bundle, steps)}
        dayIndex={state.dayIndex}
        playing={state.playing}
        forecastTag={tag}
        onSeek={(index) => dispatch({ type: "seek", index })}
        onPrev={() => dispatch({ type: "prev" })}
        onNext={() => dispatch({ type: "next" })}
        onPlayToggle={() => dispatch({ type: "togglePlay" })}
      >
        <SourceAges rows={sourceRows(bundle, nowMs)} />
      </TimelineBar>

      <footer className="shrink-0 px-5 pb-2 pt-1.5 text-xs text-cc-faint">
        Data: NASA GPM · SMAP · NASADEM · NISAR · Basemap © CARTO © OpenStreetMap · Boundaries ©{" "}
        {caseDirOf(bundle) === "wa_2025" ? "US Census" : "IBGE"} · Population: GPW (NASA SEDAC) / US Census
      </footer>
    </div>
  );
}
