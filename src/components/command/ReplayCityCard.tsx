"use client";

import { fmtDate } from "./model/format";
import { CLASS_NAMES } from "./model/places";
import type { ReplayPlace } from "./model/replayPlaces";

// Replay city card (L52): a municipality of the replay case — name, UF,
// population (estimate), the teammate NISAR flood-candidate area, and the
// shown day's observed flood class when places_daily is published. No live
// forecast numbers — this card is about the replay.
export default function ReplayCityCard({
  place,
  stepDate,
  dayClass,
  onShow,
  onClose,
}: {
  place: ReplayPlace;
  stepDate?: string;
  dayClass: number | null;
  onShow: () => void;
  onClose: () => void;
}) {
  return (
    <section aria-label={`City: ${place.name}`} data-city-card
      className="rounded-lg border border-cc-line bg-cc-surface p-2.5 text-xs shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-[15px] font-semibold">{place.name} {place.uf && <span className="font-normal text-cc-muted">{place.uf}</span>}</h2>
          {place.pop !== null && <p className="m-0 text-cc-muted">{Math.round(place.pop).toLocaleString("en-US")} residents (estimate, GPW)</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close the city card" className="rounded border border-cc-line-strong px-1.5 font-semibold">×</button>
      </div>
      {place.teammateKm2 !== null && (
        <p className="m-0 mt-1">NISAR flood candidates (teammate map): {place.teammateKm2.toLocaleString("en-US", { maximumFractionDigits: 1 })} km²</p>
      )}
      {dayClass !== null && stepDate && (
        <p className="m-0 mt-1">Flood on {fmtDate(stepDate)}: {CLASS_NAMES[dayClass] ?? "no data"}</p>
      )}
      <div className="mt-2">
        <button type="button" onClick={onShow} className="rounded-md bg-cc-accent px-2 py-1 font-semibold text-white">Show on map</button>
      </div>
    </section>
  );
}
