"use client";

import { LIST_COLLAPSED, type PriorityArea } from "./model/areas";
import { fmtPeople } from "./model/format";
import { PEOPLE_LOWER_BOUND_TITLE } from "./model/tiles";
import { NOT_PUBLISHED } from "./model/types";
import { ClassChip, Icon, ICON } from "./ui";

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
}: {
  areas: PriorityArea[];
  missingText: string; // shown when the case has no zones
  expanded: boolean;
  selected: number | null;
  asOf?: string;
  dimmed: boolean;
  onToggleAll: () => void;
  onSelect: (rank: number) => void;
  // Replay (conductor): GPW ~1 km counts are ~12% low -> "≥ 7,700".
  lowerBound?: boolean;
}) {
  const rows = expanded ? areas : areas.slice(0, LIST_COLLAPSED);
  return (
    <section aria-label="Priority areas">
      <div className="mb-0.5 flex items-center gap-2">
        <h2 className="m-0 grow text-base font-semibold">
          Priority areas
          {asOf && areas.length > 0 && <span className="ml-2 text-xs font-normal text-cc-faint">as of {asOf}</span>}
        </h2>
        {areas.length > LIST_COLLAPSED && (
          <button type="button" onClick={onToggleAll} aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 px-0.5 py-1 text-[13px] font-semibold text-cc-accent">
            {expanded ? "Show less" : `View all (${areas.length})`} <Icon d={ICON.arrowRight} size={15} strokeWidth={2.2} />
          </button>
        )}
      </div>
      {areas.length === 0 ? (
        <p className="border-t border-cc-rule py-2 text-[13px] italic text-cc-faint">Priority areas: {missingText}</p>
      ) : (
        <div className={`${dimmed ? "opacity-60" : ""} ${expanded ? "max-h-[300px] overflow-y-auto" : ""}`}>
          {rows.map((a) => (
            <button
              key={a.rank}
              type="button"
              onClick={() => onSelect(a.rank)}
              aria-pressed={selected === a.rank}
              aria-label={`Priority area ${a.rank}: ${a.label}, ${a.cls}`}
              className={`flex min-h-9 w-full items-center gap-x-2 border-t border-cc-rule px-1.5 py-0.5 text-left text-sm ${selected === a.rank ? "bg-cc-accent-soft" : "hover:bg-cc-well"}`}
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] bg-cc-ink text-[13px] font-bold text-white">{a.rank}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{a.label}</span>
              <ClassChip cls={a.cls} className="w-[72px] shrink-0" />
              <span className="shrink-0 whitespace-nowrap">TPI {a.tpi === null ? "—" : a.tpi.toFixed(2)}</span>
              <span className="inline-flex shrink-0 items-center justify-end gap-1 whitespace-nowrap">
                <Icon d={ICON.people} size={16} strokeWidth={1.8} className="text-cc-muted" />
                {a.people === null
                  ? <span className="text-xs italic text-cc-faint">{NOT_PUBLISHED}</span>
                  : lowerBound
                    ? <span title={PEOPLE_LOWER_BOUND_TITLE}>≥ {Math.floor(a.people).toLocaleString("en-US")}</span>
                    : fmtPeople(a.people)}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
