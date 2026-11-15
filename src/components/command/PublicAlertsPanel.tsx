"use client";

import { ALERT_FOOTER, ALERT_LEVEL_WORDS, EXPERIMENTAL_TEXT, type AlertCardData } from "@/lib/alerts";
import AlertCard, { LEVEL_STYLE } from "./AlertCard";
import {
  ALERTS_PAUSED_TEXT, ALERTS_UNAVAILABLE_TEXT, alertsByRegion, moreAlertsText, NO_ALERTS_TEXT, NO_RUN_TEXT,
  LANDSLIDE_OBSERVED_NOTE, LANDSLIDE_OBSERVED_TITLE, OBSERVED_NOTE, OBSERVED_TITLE,
  type AlertList, type ObservedRow,
} from "./model/alerts";
import {
  REPLAY_ALERTS_NOTE, REPLAY_ALERTS_TITLE, REPLAY_NO_ALERTS_TEXT, replayAlertsAt, replayLaterText,
} from "./model/replayAlerts";
import type { CcBundle } from "./model/types";
import { fmtBrt } from "./model/format";

// Right panel of the Public Alerts view. Three states of the alert data:
// alerts, none, unavailable. A load failure never reads "No active alerts".
export default function PublicAlertsPanel({
  alertList,
  live,
  onGoToNow,
  onViewOnMap,
  observed = [],
  observedOn = false,
  onShowObserved,
  children,
  bundle,
  stepDate,
}: {
  // Replay: the case in view and the selected timeline step date.
  bundle?: CcBundle;
  stepDate?: string;
  observed?: ObservedRow[];
  observedOn?: boolean;
  onShowObserved?: () => void;
  alertList: AlertList;
  live: boolean;
  onGoToNow: () => void;
  onViewOnMap: (alert: AlertCardData) => void;
  children?: React.ReactNode; // the "Get alerts" card
}) {
  const time = alertList.dataTime ? fmtBrt(alertList.dataTime) : undefined;
  return (
    <>
      <div>
        <h1 className="m-0 font-cc-display text-[21px] font-semibold leading-tight">Public alerts</h1>
        <p className="mt-1 text-[13px] text-cc-muted">
          Alerts are issued when the Tipping Point Index rises to High or
          Critical — max one alert every 6 h, none between 23:00 and 06:00
          unless the class is Critical.
        </p>
        {live && (
          <p role="note" data-experimental className="mt-2 rounded-md border border-[#e2c48a] bg-cc-warn-soft px-2.5 py-1.5 text-[13px] font-semibold text-cc-warn">
            {EXPERIMENTAL_TEXT} (SMS 40199).
          </p>
        )}
      </div>

      {!live ? (
        <ReplayAlerts bundle={bundle} stepDate={stepDate} onGoToNow={onGoToNow} onViewOnMap={onViewOnMap} />
      ) : alertList.state === "paused" ? (
        <div data-alerts="paused" role="status" className="rounded-[10px] border border-cc-line bg-cc-well px-3.5 py-3">
          <p className="text-[15px] font-semibold">{ALERTS_PAUSED_TEXT}</p>
          <p className="mt-0.5 text-[13px] text-cc-muted">
            No alert is shown until the latest run is checked. This does not mean there is no risk:
            follow Civil Defense guidance (SMS 40199). Latest run: {time ?? NO_RUN_TEXT}.
          </p>
        </div>
      ) : alertList.state === "unavailable" ? (
        <div data-alerts="unavailable" role="status" className="rounded-[10px] border border-[#e2c48a] bg-cc-warn-soft px-3.5 py-3">
          <p className="text-[15px] font-semibold text-cc-warn">{ALERTS_UNAVAILABLE_TEXT}</p>
          <p className="mt-0.5 text-[13px]">
            The alert data is not published or failed to load. This does not mean there is no risk.
            Last known run: {time ?? NO_RUN_TEXT}.
          </p>
        </div>
      ) : alertList.state === "none" ? (
        <div data-alerts="none" role="status" className="rounded-[10px] border border-cc-accent-line bg-cc-accent-soft px-3.5 py-3">
          <p className="text-[15px] font-semibold">{NO_ALERTS_TEXT}</p>
          <p className="mt-0.5 text-[13px]">Alert data of {time ?? "an unknown time"}.</p>
        </div>
      ) : (
        <>
          <ul data-alerts="alerts" className="m-0 flex list-none flex-col gap-2.5 p-0">
            {alertList.alerts.map((a) => (
              <AlertCard key={a.id} alert={a} onViewOnMap={onViewOnMap} experimental />
            ))}
          </ul>
          {moreAlertsText(alertList) && (
            <p data-alerts-more className="text-[13px] text-cc-muted">{moreAlertsText(alertList)}</p>
          )}
          <section aria-label="Alerts by region">
            <h2 className="m-0 mb-0.5 text-base font-semibold">Alerts by region</h2>
            {(alertList.regions ?? alertsByRegion(alertList.alerts)).map((r) => (
              <div key={r.region} className="flex min-h-10 items-center gap-2.5 border-t border-cc-rule px-1.5 py-1 text-sm">
                <span className={`w-[84px] shrink-0 rounded-[5px] py-0.5 text-center text-xs font-bold ${LEVEL_STYLE[r.level]?.chip ?? ""}`}>
                  {ALERT_LEVEL_WORDS[r.level] ?? r.level}
                </span>
                <span className="min-w-0 flex-1 font-semibold">{r.region}</span>
                <span className="text-[13px] text-cc-muted">{r.count} {r.count === 1 ? "alert" : "alerts"}</span>
              </div>
            ))}
            <p className="border-t border-cc-rule pt-1 text-xs text-cc-faint">Alert data of {time ?? "an unknown time"}.</p>
          </section>
        </>
      )}

      {live && (
        <ObservedSection title={OBSERVED_TITLE} note={OBSERVED_NOTE}
          rows={observed.filter((o) => o.hazard !== "landslide")}
          showOn={observedOn} onShow={onShowObserved} />
      )}
      {live && (
        <ObservedSection title={LANDSLIDE_OBSERVED_TITLE} note={LANDSLIDE_OBSERVED_NOTE}
          rows={observed.filter((o) => o.hazard === "landslide")} />
      )}

      {/* Brazilian Civil Defense contact line: the live (Southern Brazil) view only. */}
      {live && <p className="text-[13px] font-semibold text-cc-muted">{ALERT_FOOTER}</p>}
      {children}
    </>
  );
}

// Replay: what the live alert rule would have issued, up to the selected step.
function ReplayAlerts({
  bundle,
  stepDate,
  onGoToNow,
  onViewOnMap,
}: {
  bundle?: CcBundle;
  stepDate?: string;
  onGoToNow: () => void;
  onViewOnMap: (alert: AlertCardData) => void;
}) {
  const { shown, later } = replayAlertsAt(bundle, stepDate);
  const laterText = replayLaterText(later);
  return (
    <section data-alerts="replay" aria-label={REPLAY_ALERTS_TITLE} className="flex flex-col gap-2.5">
      <h2 className="m-0 text-base font-semibold">{REPLAY_ALERTS_TITLE}</h2>
      {shown.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {shown.map((a) => (
            <AlertCard key={a.id} alert={a} onViewOnMap={onViewOnMap} noFooter />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-cc-muted">
          {later > 0 ? "No alert yet at this step." : REPLAY_NO_ALERTS_TEXT}
        </p>
      )}
      {laterText && <p data-replay-later className="text-[13px] text-cc-muted">{laterText}</p>}
      <p className="text-xs italic text-cc-muted">{REPLAY_ALERTS_NOTE}</p>
      <div>
        <button type="button" onClick={onGoToNow}
          className="rounded-lg border border-cc-line-strong bg-cc-surface px-2.5 py-1 text-xs font-semibold">
          Go to Now
        </button>
      </div>
    </section>
  );
}

// Satellite observations of one kind (radar flood, or optical landslide scar
// candidates): neutral styling, never an alert level.
function ObservedSection({ title, note, rows, showOn = false, onShow }: {
  title: string;
  note: string;
  rows: ObservedRow[];
  showOn?: boolean;
  onShow?: () => void;
}) {
  if (!rows.length) return null;
  return (
    <section aria-label={title} data-observed className="rounded-[10px] border border-cc-line bg-cc-well px-3.5 py-3">
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-[13px] text-cc-muted">{note}</p>
      <ul className="m-0 mt-1.5 list-none p-0">
        {rows.map((o) => (
          <li key={o.key} className="border-t border-cc-rule py-1.5 text-[13px]">
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{o.source}</span>
              <span>{o.area}</span>
            </div>
            <div>{o.places}</div>
            <div className="text-xs text-cc-muted">
              {o.acquired ? `newest pass ${o.acquired}` : ""}
              {o.people ? `${o.acquired ? " · " : ""}${o.people} people (estimate)` : ""}
              {o.polygons !== undefined ? ` · ${o.polygons} ${o.polygons === 1 ? "area" : "areas"}` : ""}
            </div>
          </li>
        ))}
      </ul>
      {onShow && (
        <button type="button" onClick={onShow} aria-pressed={showOn}
          className="mt-1.5 rounded-lg border border-cc-line-strong bg-cc-surface px-2.5 py-1.5 text-xs font-semibold">
          {showOn ? "Hide on map" : "Show on map"}
        </button>
      )}
    </section>
  );
}
