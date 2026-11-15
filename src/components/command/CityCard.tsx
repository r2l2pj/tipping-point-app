"use client";

import { fmtDate } from "./model/format";
import { CLASS_COLORS, className, type HazardDays, type Place } from "./model/places";
import { horizonLabel } from "@/lib/layers";

// City card (Lucas): one municipality of the Now run — population, today's
// class per hazard, the d0..d3 forecast strip, the ML likelihood per horizon,
// the alert. Everything from places.json; nothing is recomputed here.
function Strip({ label, h, dates }: { label: string; h: HazardDays; dates: string[] }) {
  return (
    <div className="mt-1">
      <div className="text-xs text-cc-muted">{label}</div>
      <div className="mt-0.5 grid grid-cols-4 gap-1">
        {dates.map((d, i) => {
          const c = h.cls[i] ?? null;
          return (
            <div key={d} className="rounded border border-cc-line px-1 py-0.5 text-center text-[11px] leading-tight"
              title={h.max[i] !== null && h.max[i] !== undefined ? `max TPI ${h.max[i]!.toFixed(2)}` : "no data"}>
              <div className="text-cc-muted">{i === 0 ? "Today" : fmtDate(d).replace(/,\s*\d{4}$/, "")}</div>
              <div className="mt-0.5 flex items-center justify-center gap-1 font-semibold">
                {c !== null && <span className="inline-block h-2.5 w-2.5 rounded-sm border border-black/20" style={{ background: CLASS_COLORS[c] }} />}
                {className(c)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CityCard({ place, dates, onShow, onClose }: {
  place: Place;
  dates: string[];
  onShow: () => void;
  onClose: () => void;
}) {
  const hs = ["24h", "48h", "72h", "7d"].filter((h) => place.pTrigger[h]);
  return (
    <section aria-label={`City: ${place.name}`} data-city-card
      className="rounded-lg border border-cc-line bg-cc-surface p-2.5 text-xs shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-[15px] font-semibold">{place.name} <span className="font-normal text-cc-muted">{place.uf}</span></h2>
          {place.pop !== null && <p className="m-0 text-cc-muted">{Math.round(place.pop).toLocaleString("en-US")} residents (estimate, GPW)</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close the city card" className="rounded border border-cc-line-strong px-1.5 font-semibold">×</button>
      </div>
      {place.alert && (
        <p className="m-0 mt-1 rounded bg-cc-danger-soft px-1.5 py-0.5 font-semibold text-[#9b0020]">
          Experimental alert: {place.alertLevel === "Crítico" ? "Critical" : place.alertLevel === "Alto" ? "High" : place.alertLevel} {place.alertHazard?.replace("+", " + ")} risk
        </p>
      )}
      {place.peopleHigh !== null && place.peopleHigh > 0 && (
        <p className="m-0 mt-1">{Math.round(place.peopleHigh).toLocaleString("en-US")} people in High or Critical cells (today or tomorrow, estimate)</p>
      )}
      <Strip label="Flood risk (rain index, NOAA GFS forecast after today)" h={place.flood} dates={dates} />
      <Strip label="Landslide risk (rain index)" h={place.slide} dates={dates} />
      {hs.length > 0 && (
        <div className="mt-1.5">
          <div className="text-xs text-cc-muted">Landslide likelihood (ML, experimental — relative, not a %)</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {hs.map((h) => (
              <span key={h} className="rounded border border-cc-line px-1.5 py-0.5">
                next {horizonLabel(h)}: <span className="font-semibold">{place.pTrigger[h]?.max !== null && place.pTrigger[h]?.max !== undefined ? place.pTrigger[h]!.max!.toFixed(2) : "—"}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onShow} className="rounded-md bg-cc-accent px-2 py-1 font-semibold text-white">Show on map</button>
      </div>
    </section>
  );
}
