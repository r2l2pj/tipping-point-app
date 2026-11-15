"use client";

import { ALERT_FOOTER, ALERT_LEVEL_WORDS, type AlertCardData } from "@/lib/alerts";
import AlertCard, { LEVEL_STYLE } from "./AlertCard";
import {
  ALERTS_PAUSED_TEXT, ALERTS_UNAVAILABLE_TEXT, alertsByRegion, moreAlertsText, NO_ALERTS_TEXT, NO_RUN_TEXT,
  REPLAY_NO_FEED_TEXT, type AlertList,
} from "./model/alerts";
import { fmtBrt } from "./model/format";

// Right panel of the Public Alerts view. Three states of the alert data:
// alerts, none, unavailable. A load failure never reads "No active alerts".
export default function PublicAlertsPanel({
  alertList,
  live,
  onGoToNow,
  onViewOnMap,
  children,
}: {
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
      </div>

      {!live ? (
        <div data-alerts="replay" className="rounded-[10px] border border-cc-line bg-cc-well px-3.5 py-3">
          <p className="text-sm font-semibold">{REPLAY_NO_FEED_TEXT}</p>
          <p className="mt-0.5 text-[13px] text-cc-muted">Public alerts come from the live run only.</p>
          <button type="button" onClick={onGoToNow} className="mt-2 rounded-lg bg-cc-accent px-3 py-1.5 text-[13px] font-semibold text-white">
            Go to Now
          </button>
        </div>
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
              <AlertCard key={a.id} alert={a} onViewOnMap={onViewOnMap} />
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

      <p className="text-[13px] font-semibold text-cc-muted">{ALERT_FOOTER}</p>
      {children}
    </>
  );
}
