"use client";

import { ALERT_FOOTER, ALERT_LEVEL_WORDS, EXPERIMENTAL_TEXT, heldLabel, type AlertCardData } from "@/lib/alerts";
import type { AlertLevel } from "@/lib/types";
import { fmtBrt, fmtDate, fmtKm2 } from "./model/format";

export const LEVEL_STYLE: Record<AlertLevel, { chip: string; border: string }> = {
  emergency: { chip: "bg-[#bd0026] text-white", border: "border-[#e2a3ad] bg-cc-danger-soft" },
  warning: { chip: "bg-[#fd8d3c] text-cc-ink", border: "border-[#f0c49c] bg-[#fff3e8]" },
  watch: { chip: "bg-[#fecc5c] text-cc-ink", border: "border-[#e8d08e] bg-[#fffaea]" },
};

// One alert, in the message format the Telegram bot sends. Every field of the
// old alerts page is kept. "View on the map" is an action, not a link.
export default function AlertCard({
  alert: a,
  onViewOnMap,
  noFooter = false,
  experimental = false,
}: {
  alert: AlertCardData;
  onViewOnMap: (alert: AlertCardData) => void;
  // Replay cards: the Civil Defense contact line (a Brazilian number) is
  // not shown — the replay may be another country and nothing was sent.
  noFooter?: boolean;
  experimental?: boolean; // live cards: "Experimental — not an official warning"
}) {
  const style = LEVEL_STYLE[a.level] ?? LEVEL_STYLE.watch;
  const word = ALERT_LEVEL_WORDS[a.level] ?? ALERT_LEVEL_WORDS.watch;
  const hazardWord = a.hazard || "flood or landslide";
  const held = heldLabel(a);
  const imerg = a.data_dates?.imerg;
  const smap = a.data_dates?.smap;
  // G4: lead-live's smap_label is Portuguese; the UI is English (rule 8), so
  // the card builds the same fact from the ISO date + smap_age_days.
  const smapAge = Number(a.data_dates?.smap_age_days);
  const smapAgeText = Number.isFinite(smapAge) && smapAge >= 1 ? ` (${smapAge} day${smapAge === 1 ? "" : "s"} old)` : "";
  const tag = "rounded border border-cc-line-strong bg-cc-surface px-1.5 py-0.5";
  return (
    <li className={`rounded-[10px] border px-3.5 py-3 ${style.border}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] font-semibold">{a.title ?? `Tipping Point: ${word} ${hazardWord} risk`}</p>
        <span className={`shrink-0 rounded-[5px] px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${style.chip}`}>{a.level}</span>
      </div>
      {experimental && <p className="mt-1 text-xs font-semibold text-cc-warn" data-experimental-card>{EXPERIMENTAL_TEXT}</p>}
      <p className="mt-1.5 text-[13px]"><span className="text-cc-muted">Region:</span> {a.region ?? a.area}</p>
      {a.first_issued_at && (
        <p className="mt-1 text-[13px]">
          <span className="text-cc-muted">First issued</span> {fmtBrt(a.first_issued_at)}
          {a.last_confirmed_at && a.last_confirmed_at !== a.first_issued_at && (
            <> · <span className="text-cc-muted">confirmed</span> {fmtBrt(a.last_confirmed_at)}</>
          )}
        </p>
      )}
      {a.basis && (
        <p className="mt-1 text-[13px] font-semibold text-cc-forecast-ink">{a.basis.charAt(0).toUpperCase() + a.basis.slice(1)}</p>
      )}
      {(a.area_km2 !== undefined || a.when) && (
        <p className="mt-1 text-[13px]">
          {a.area_km2 !== undefined && <><span className="text-cc-muted">Area:</span> {fmtKm2(a.area_km2)}</>}
          {a.area_km2 !== undefined && a.when ? " · " : ""}
          {a.when && <><span className="text-cc-muted">When:</span> {a.when === "today" ? "today" : "tomorrow (forecast)"}</>}
          {a.when === "d1" && a.today_level && (
            <> · <span className="text-cc-muted">today:</span> {a.today_level === "below" ? "below High" : (ALERT_LEVEL_WORDS[a.today_level] ?? a.today_level).toLowerCase()}</>
          )}
        </p>
      )}
      {a.rain && <p className="mt-1 text-[13px]">{a.rain} {a.soil}</p>}
      {a.forecast && <p className="mt-1 text-[13px]">Forecast: {a.forecast}</p>}
      {(imerg || smap) && (
        <p className="mt-1 text-xs text-cc-muted">
          NASA data: {imerg ? `IMERG through ${fmtDate(imerg)}` : ""}
          {imerg && smap ? " · " : ""}
          {smap ? `SMAP ${fmtDate(smap)}${smapAgeText}` : ""}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cc-muted">
        <span>Valid {fmtDate(a.valid_from)} → {fmtDate(a.valid_to)}</span>
        {held && <span className="rounded border border-[#e2c48a] bg-cc-warn-soft px-1.5 py-0.5 font-semibold text-cc-warn">{held}</span>}
        <span className={tag}>certainty: {a.certainty}</span>
        <span className={tag}>hazard: {a.hazard}</span>
      </div>
      <p className="mt-2 text-[13px]">{a.guidance}</p>
      {!noFooter && !a.guidance.endsWith(ALERT_FOOTER) && <p className="mt-1.5 text-xs font-semibold text-cc-muted">{ALERT_FOOTER}</p>}
      <button type="button" onClick={() => onViewOnMap(a)}
        className="mt-2 text-[13px] font-semibold text-cc-accent underline decoration-dotted underline-offset-2">
        View on the map
      </button>
    </li>
  );
}
