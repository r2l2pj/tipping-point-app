"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Marker, type Map as MapInstance } from "maplibre-gl";
import type { PriorityArea } from "./model/areas";
import { fmtDataDate, fmtKm2, fmtPeople } from "./model/format";
import { pointKey, pointRequest, readPoint, type PointValues } from "./model/pointRead";
import { NOT_PUBLISHED, type CcBundle, type Hazard } from "./model/types";
import { ClassChip, Icon, ICON } from "./ui";

// Card anchored to the selected pin. The expanded part reads R, S and T once
// per (case, date, area) and shows where the values come from.
export default function AreaCallout({
  map,
  bundle,
  area,
  stepDate,
  hazard,
  expanded,
  onToggle,
  onClose,
}: {
  map: MapInstance | null;
  bundle: CcBundle;
  area: PriorityArea | undefined;
  stepDate: string | undefined;
  hazard: Hazard;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  // Element of the map marker; the card is rendered into it. Client only.
  const [host] = useState<HTMLDivElement | null>(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.className = "cc-callout-marker";
    return el;
  });
  const [reads, setReads] = useState<Record<string, PointValues | null>>({});
  const started = useRef(new Set<string>());

  useEffect(() => {
    if (!map || !host || !area?.at) return;
    const marker = new Marker({ element: host, anchor: "bottom", offset: [0, -20] })
      .setLngLat(area.at)
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, host, area]);

  const request = area?.at && stepDate ? pointRequest(bundle, stepDate, hazard, area.at) : undefined;
  const key = request ? pointKey(request) : undefined;

  // One read per (case, date, hazard, area); the result is cached.
  useEffect(() => {
    if (!expanded || !request || !key || started.current.has(key)) return;
    started.current.add(key);
    void readPoint(request).then((values) =>
      setReads((prev) => ({ ...prev, [key]: values }))
    );
    // `key` identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, key]);

  if (!host || !area) return null;
  const read = key && key in reads ? { values: reads[key] } : undefined;
  const dd = bundle.data_dates ?? {};
  const inputDate = (k: string) =>
    typeof dd[k] === "string" ? fmtDataDate(dd[k] as string) : NOT_PUBLISHED;
  const score = (v: number | null) => (v === null ? "no data" : v.toFixed(2));

  return createPortal(
    <AreaCard
      area={area}
      partsNote={bundle.mode === "live"}
      expanded={expanded}
      onToggle={onToggle}
      onClose={onClose}
    >
      {!request ? (
        <span>R, S and T: {NOT_PUBLISHED} (no step selected)</span>
      ) : !read ? (
        <span>Reading R, S and T for this point…</span>
      ) : read.values ? (
        <>
          <span>
            R {score(read.values.r)} · S {score(read.values.s)} · T {score(read.values.t)}
            {read.values.tpi !== null ? ` · TPI at the pin ${score(read.values.tpi)}` : ""}
          </span>
          <span className="text-[#c9d3d0]">
            {read.values.source} · step {fmtDataDate(stepDate)}
          </span>
        </>
      ) : (
        <span>R, S and T: {NOT_PUBLISHED} for this point and date</span>
      )}
      <span className="text-[#c9d3d0]">
        Inputs: IMERG {inputDate("imerg")} · SMAP {inputDate("smap")}
      </span>
    </AreaCard>,
    host
  );
}

// Pure markup of the card, so the rule tests can render it without a map.
export function AreaCard({
  area,
  partsNote = false,
  expanded,
  onToggle,
  onClose,
  children,
}: {
  area: PriorityArea;
  // Now: the zone is the whole municipality; people/area are its at-risk part.
  partsNote?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={`Priority area ${area.rank}: ${area.name}`}
      className="w-[272px] max-w-[80vw] rounded-xl border-[1.5px] border-white bg-[rgba(15,24,26,0.94)] px-3 py-2.5 text-white shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <strong className="text-[15px]">{area.label}</strong>
          <ClassChip cls={area.cls} className="!py-px !text-xs" />
        </div>
        <button type="button" onClick={onToggle} aria-expanded={expanded}
          aria-label={expanded ? "Hide R, S and T" : "Show R, S and T"}
          className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-white/45">
          <Icon d={ICON.chevronRight} size={16} strokeWidth={2.2} className={expanded ? "rotate-90" : ""} />
        </button>
        <button type="button" onClick={onClose} aria-label="Close the area card"
          className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-white/45">
          <Icon d={ICON.close} size={16} strokeWidth={2.2} />
        </button>
      </div>
      <div className="mt-0.5 text-[13px] text-[#e7ecea]">
        TPI {area.tpi === null ? NOT_PUBLISHED : area.tpi.toFixed(2)}
        {area.hazard ? ` · ${area.hazard}` : ""} · {area.areaKm2 === null ? `area ${NOT_PUBLISHED}` : fmtKm2(area.areaKm2)}
      </div>
      <div className="text-[13px] text-[#c9d3d0]">
        {area.peopleInvalid
          ? <>People: —</>
          : partsNote && area.people !== null && area.areaKm2 !== null
            ? <>{Math.round(area.people).toLocaleString("en-US")} people in the at-risk part ({fmtKm2(area.areaKm2)}) of {area.name}</>
            : <>People: {area.people === null ? NOT_PUBLISHED : fmtPeople(area.people)}</>}
      </div>
      {expanded && (
        <div className="mt-2 flex flex-col gap-[3px] border-t border-white/30 pt-2 text-[13px] text-[#e7ecea]">
          {children}
        </div>
      )}
    </div>
  );
}
