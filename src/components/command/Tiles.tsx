import type { Tile } from "./model/tiles";
import { Icon, ICON, Value } from "./ui";

function TileCard({ tile, icon }: { tile: Tile; icon: React.ReactNode }) {
  return (
    <div className={`flex flex-1 items-center gap-3 rounded-[10px] border border-cc-line px-3 py-1.5 ${tile.dimmed ? "opacity-60" : ""}`}>
      {icon}
      <div className="min-w-0">
        <div className="text-xs text-cc-muted">{tile.label}</div>
        <div className="text-[21px] leading-tight"><Value text={tile.value} missing={tile.missing} /></div>
        {(tile.asOf || tile.note) && (
          <div className="text-xs text-cc-faint">
            {[tile.note, tile.asOf ? `as of ${tile.asOf}` : undefined].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Tiles({ area, people }: { area: Tile; people: Tile }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      <TileCard tile={area} icon={
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3.2 2.6" aria-hidden="true" className="shrink-0">
          <rect x="4" y="4" width="16" height="16" rx="1.5" />
        </svg>
      } />
      <TileCard tile={people} icon={<Icon d={ICON.people} size={30} strokeWidth={1.7} className="shrink-0" />} />
    </div>
  );
}
