import type { Tile } from "./model/tiles";
import { Icon, ICON, Value } from "./ui";

function TileCard({ tile, icon }: { tile: Tile; icon: React.ReactNode }) {
  return (
    <div className={`flex min-w-[150px] flex-1 flex-col rounded-[10px] border border-cc-line bg-cc-well px-3 py-2 ${tile.dimmed ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-cc-muted">{icon}{tile.label}</div>
        <div className="mt-0.5 text-[22px] leading-tight tabular-nums" title={tile.title}><Value text={tile.value} missing={tile.missing} /></div>
        {(tile.asOf || tile.note) && (
          <div className="text-xs text-cc-faint">
            {[tile.note, tile.asOf ? `as of ${tile.asOf}` : undefined].filter(Boolean).join(" · ")}
          </div>
        )}
    </div>
  );
}

export default function Tiles({ area, people }: { area: Tile; people: Tile }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      <TileCard tile={area} icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3.2 2.6" aria-hidden="true" className="shrink-0">
          <rect x="4" y="4" width="16" height="16" rx="1.5" />
        </svg>
      } />
      <TileCard tile={people} icon={<Icon d={ICON.people} size={16} strokeWidth={2} className="shrink-0" />} />
    </div>
  );
}
