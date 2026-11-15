"use client";

import { useMemo, useState } from "react";
import { LIST_COLLAPSED, severityOf, type PriorityArea } from "./model/areas";
import { fmtKm2, fmtPeople } from "./model/format";
import { PEOPLE_TITLE } from "./model/tiles";
import { NOT_PUBLISHED } from "./model/types";
import { ClassChip, Icon, ICON } from "./ui";

// Columns of the table. Each one sorts; the first click takes the order a
// reader expects of it (largest first for numbers, A to Z for names).
type SortKey = "rank" | "name" | "cls" | "tpi" | "people" | "area";
const COLUMNS: { key: SortKey; label: string; title: string; first: 1 | -1; align: string }[] = [
  { key: "rank", label: "#", title: "Priority: most severe first (class, then TPI)", first: 1, align: "justify-start" },
  { key: "name", label: "Area", title: "Name of the area", first: 1, align: "justify-start" },
  { key: "cls", label: "Class", title: "Risk class", first: -1, align: "justify-start" },
  { key: "tpi", label: "TPI", title: "Tipping Point Index, 0 to 1", first: -1, align: "justify-end" },
  { key: "people", label: "People", title: "People in the area", first: -1, align: "justify-end" },
  { key: "area", label: "km²", title: "Size of the area in km²", first: -1, align: "justify-end" },
];
// Phones drop the km² column (it stays in the row tooltip) so the name fits.
const GRID = "grid grid-cols-[1.5rem_minmax(0,1fr)_4.25rem_2.5rem_3.5rem] min-[480px]:grid-cols-[1.5rem_minmax(0,1fr)_4.75rem_2.5rem_3.75rem_3rem] items-center gap-x-2";
const WIDE_ONLY = "max-[479px]:hidden";

// A missing value sorts last in both directions.
const valueOf = (a: PriorityArea, key: SortKey): number | string | null =>
  key === "rank" ? a.rank
  : key === "name" ? (a.name ?? a.label).toLocaleLowerCase()
  : key === "cls" ? severityOf(a.cls)
  : key === "tpi" ? a.tpi
  : key === "people" ? a.people
  : a.areaKm2;

// The full sentence of a row, for the tooltip. Conductor: the zone is drawn
// as the whole municipality while the count covers only its at-risk part.
const partTitle = (a: PriorityArea, partsNote: boolean, estimate: boolean): string | undefined =>
  a.people === null || a.areaKm2 === null ? undefined
  : partsNote
    ? `${Math.round(a.people).toLocaleString("en-US")} people in the at-risk part (${fmtKm2(a.areaKm2)}) of ${a.name}`
    : `${Math.round(a.people).toLocaleString("en-US")} people in ${fmtKm2(a.areaKm2)}${estimate ? " (estimate)" : ""}`;

export function sortAreas(areas: PriorityArea[], key: SortKey, dir: 1 | -1): PriorityArea[] {
  if (key === "rank" && dir === 1) return areas;
  return [...areas].sort((a, b) => {
    const x = valueOf(a, key);
    const y = valueOf(b, key);
    if (x === null || y === null) return x === y ? a.rank - b.rank : x === null ? 1 : -1;
    const order = typeof x === "string" ? x.localeCompare(y as string) : x - (y as number);
    return order * dir || a.rank - b.rank;
  });
}

// The zone snapshot. It does not follow the timeline: off the snapshot day
// it is drawn dimmed with its date, never recomputed.
export default function PriorityAreas({
  areas,
  missingText,
  expanded,
  selected,
  asOf,
  dimmed,
  onToggleAll,
  onSelect,
  lowerBound = false,
  partsNote = false,
  onJumpToSnapshot,
}: {
  areas: PriorityArea[];
  missingText: string; // shown when the case has no zones
  expanded: boolean;
  selected: number | null;
  asOf?: string;
  dimmed: boolean;
  onToggleAll: () => void;
  onSelect: (rank: number) => void;
  // Replay: exact native-grid counts, tooltip names the method.
  lowerBound?: boolean;
  // Now: zones are whole municipalities; people/area cover the at-risk part.
  partsNote?: boolean;
  // Replay, off the snapshot day: the list is one snapshot (the event day) —
  // say so and offer to move the timeline there (external review).
  onJumpToSnapshot?: () => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const sorted = useMemo(() => sortAreas(areas, sort.key, sort.dir), [areas, sort]);
  const rows = expanded ? sorted : sorted.slice(0, LIST_COLLAPSED);
  const sortBy = (key: SortKey, first: 1 | -1) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: first }));
  return (
    <section aria-label="Priority areas">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="m-0 grow text-sm font-semibold">
          Priority areas
          {asOf && areas.length > 0 && <span className="ml-2 text-xs font-normal text-cc-faint">as of {asOf}</span>}
        </h3>
        {areas.length > LIST_COLLAPSED && (
          <button type="button" onClick={onToggleAll} aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 px-0.5 py-1 text-[13px] font-semibold text-cc-accent">
            {expanded ? "Show less" : `View all (${areas.length})`} <Icon d={ICON.arrowRight} size={15} strokeWidth={2.2} />
          </button>
        )}
      </div>
      {dimmed && asOf && areas.length > 0 && onJumpToSnapshot && (
        <p className="m-0 mb-1 text-xs text-cc-muted" data-zone-snapshot>
          These areas are the {asOf} snapshot and do not follow the timeline.{" "}
          <button type="button" onClick={onJumpToSnapshot} className="font-semibold text-cc-accent underline">Go to {asOf}</button>
        </p>
      )}
      {areas.length === 0 ? (
        <p className="border-t border-cc-rule py-2 text-[13px] italic text-cc-faint">Priority areas: {missingText}</p>
      ) : (
        <div data-area-table data-sort={`${sort.key}:${sort.dir === 1 ? "asc" : "desc"}`}
          className={`rounded-lg border border-cc-line ${dimmed ? "opacity-60" : ""} ${expanded ? "max-h-[320px] overflow-y-auto overscroll-contain" : "overflow-hidden"}`}>
          <div role="group" aria-label="Sort the priority areas" className={`${GRID} sticky top-0 z-[1] border-b border-cc-line bg-cc-well px-2 py-1 text-xs font-semibold text-cc-muted`}>
            {COLUMNS.map((c) => {
              const active = sort.key === c.key;
              return (
                <span key={c.key} className={`flex ${c.align} ${c.key === "area" ? WIDE_ONLY : ""}`}>
                  <button type="button" onClick={() => sortBy(c.key, c.first)} title={`${c.title}. Click to sort.`}
                    aria-pressed={active}
                    aria-label={`Sort by ${c.title}${active ? (sort.dir === 1 ? ", ascending" : ", descending") : ""}`}
                    className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded ${active ? "text-cc-ink" : "hover:text-cc-ink"}`}>
                    {c.label}
                    <span aria-hidden="true" className={`text-[10px] leading-none ${active ? "" : "opacity-0"}`}>{sort.dir === 1 ? "▲" : "▼"}</span>
                  </button>
                </span>
              );
            })}
          </div>
          {rows.map((a) => (
            <button
              key={a.rank}
              type="button"
              onClick={() => onSelect(a.rank)}
              aria-pressed={selected === a.rank}
              aria-label={`Priority area ${a.rank}: ${a.label}, ${a.cls}`}
              title={partTitle(a, partsNote, lowerBound)}
              className={`${GRID} min-h-10 w-full border-t border-cc-rule px-2 py-1 text-left text-[13px] first:border-t-0 ${selected === a.rank ? "bg-cc-accent-soft" : "hover:bg-cc-well"}`}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] bg-cc-ink text-xs font-bold text-white">{a.rank}</span>
              <span className="min-w-0">
                {/* The row number already tells same-name areas apart. */}
                <span className="line-clamp-2 font-semibold leading-tight">{a.name ?? a.label}</span>
                {a.hazard && <span className="block truncate text-[11px] font-normal capitalize leading-tight text-cc-muted">{a.hazard}</span>}
                {a.nextLook && <span className="block truncate text-[11px] font-normal text-cc-muted" data-zone-next>{a.nextLook}</span>}
              </span>
              <span><ClassChip cls={a.cls} className="block w-full !px-1 !text-xs" /></span>
              <span className="text-right tabular-nums">{a.tpi === null ? "—" : a.tpi.toFixed(2)}</span>
              <span className="text-right tabular-nums">
                {a.peopleInvalid
                  ? <span className="text-cc-faint" title="value not valid">—</span>
                  : a.people === null
                  ? <span className="text-cc-faint" title={NOT_PUBLISHED}><span aria-hidden="true">—</span><span className="sr-only">{NOT_PUBLISHED}</span></span>
                  : lowerBound
                    ? <span title={PEOPLE_TITLE}>{Math.round(a.people).toLocaleString("en-US")}</span>
                    : fmtPeople(a.people)}
              </span>
              <span className={`text-right tabular-nums text-cc-muted ${WIDE_ONLY}`}>
                {a.areaKm2 === null ? "—" : fmtKm2(a.areaKm2).replace(" km²", "")}
              </span>
            </button>
          ))}
        </div>
      )}
      {areas.length > 0 && (
        <p className="m-0 mt-1 text-[11px] leading-snug text-cc-faint" data-zone-part>
          {partsNote
            ? "People and km² cover the at-risk part of each municipality, not the whole municipality."
            : `People and km² are for the area itself${lowerBound ? " (people: estimate)" : ""}.`}
          {" "}Most severe first; click a column to sort, a row to find it on the map.
        </p>
      )}
    </section>
  );
}
